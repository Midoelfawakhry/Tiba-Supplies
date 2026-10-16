-- Keep branch directory availability truthful while hiding private pending direct-trip details.
CREATE OR REPLACE FUNCTION public.branch_get_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_actor uuid;
  v_office public.offices%rowtype;
BEGIN
  v_actor := public.current_ras_sedr_branch_user();
  SELECT * INTO v_office FROM public.offices
  WHERE office_code='RAS_SEDR' AND office_type='BRANCH' AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'BRANCH_OFFICE_INACTIVE'; END IF;

  RETURN jsonb_build_object(
    'office',jsonb_build_object('office_id',v_office.office_id,'office_code',v_office.office_code,'name',v_office.name,'latitude',v_office.latitude,'longitude',v_office.longitude,'geofence_radius_m',v_office.geofence_radius_m),
    'available_loads',coalesce((
      SELECT jsonb_agg(jsonb_build_object('load_order_id',lo.load_order_id,'order_number',lo.order_number,'factory_id',f.factory_id,'factory_name',f.name,'quarry_id',q.quarry_id,'quarry_name',q.name,'requested_quantity',lo.requested_quantity,'committed_quantity',coalesce(x.committed_quantity,0),'priority',lo.priority,'status',lo.status,'created_at',lo.created_at,'published_at',lo.published_at,'notes',lo.notes) ORDER BY lo.priority ASC,lo.created_at ASC)
      FROM public.load_orders lo
      JOIN public.factories f ON f.factory_id=lo.factory_id
      JOIN public.quarries q ON q.quarry_id=lo.quarry_id
      LEFT JOIN LATERAL (SELECT count(*)::integer AS committed_quantity FROM public.bookings b WHERE b.load_order_id=lo.load_order_id AND b.status<>'CANCELLED') x ON true
      WHERE lo.status IN ('PUBLISHED','IN_PROGRESS')
        AND NOT EXISTS (
          SELECT 1 FROM public.bookings pending
          WHERE pending.load_order_id=lo.load_order_id
            AND pending.assignment_type='DIRECT'
            AND pending.direct_acceptance_status='PENDING'
            AND pending.status='ASSIGNED'
        )
    ),'[]'::jsonb),
    'allocations',coalesce((
      SELECT jsonb_agg(jsonb_build_object('booking_id',b.booking_id,'load_order_id',b.load_order_id,'order_number',lo.order_number,'driver_id',d.driver_id,'driver_name',d.name,'driver_code',d.driver_code,'driver_phone',d.phone,'vehicle_id',v.vehicle_id,'plate_number',v.plate_number,'vehicle_code',v.vehicle_code,'factory_name',f.name,'quarry_name',q.name,'trip_code',b.trip_code,'status',b.status,'assignment_type',b.assignment_type,'assigned_at',b.assigned_at,'arrived_at',b.arrived_at) ORDER BY b.assigned_at DESC)
      FROM public.bookings b JOIN public.drivers d ON d.driver_id=b.driver_id JOIN public.vehicles v ON v.vehicle_id=b.vehicle_id
      JOIN public.load_orders lo ON lo.load_order_id=b.load_order_id JOIN public.factories f ON f.factory_id=lo.factory_id JOIN public.quarries q ON q.quarry_id=lo.quarry_id
      WHERE d.office_id=v_office.office_id AND v.office_id=v_office.office_id
        AND NOT (b.assignment_type='DIRECT' AND b.direct_acceptance_status='PENDING' AND b.status='ASSIGNED')
    ),'[]'::jsonb),
    'actual_loading_records',coalesce((
      SELECT jsonb_agg(jsonb_build_object('actual_load_id',al.actual_load_id,'booking_id',al.booking_id,'actual_weight',al.actual_weight,'ticket_number',al.ticket_number,'loaded_at',al.loaded_at,'notes',al.notes,'driver_name',d.name,'plate_number',v.plate_number,'factory_name',f.name,'quarry_name',q.name,'trip_code',b.trip_code,'order_number',lo.order_number) ORDER BY al.loaded_at DESC)
      FROM public.actual_loading_records al JOIN public.bookings b ON b.booking_id=al.booking_id
      JOIN public.drivers d ON d.driver_id=b.driver_id JOIN public.vehicles v ON v.vehicle_id=b.vehicle_id
      JOIN public.load_orders lo ON lo.load_order_id=b.load_order_id JOIN public.factories f ON f.factory_id=lo.factory_id JOIN public.quarries q ON q.quarry_id=lo.quarry_id
      WHERE d.office_id=v_office.office_id AND v.office_id=v_office.office_id
    ),'[]'::jsonb),
    'waiting_list','[]'::jsonb,
    'directory',coalesce((
      SELECT jsonb_agg(jsonb_build_object('driver_id',d.driver_id,'driver_code',d.driver_code,'name',d.name,'phone',d.phone,'is_active',d.is_active,'vehicle_id',v.vehicle_id,'plate_number',v.plate_number,'vehicle_code',v.vehicle_code,
        'availability',CASE WHEN d.is_active AND v.is_active AND NOT EXISTS(SELECT 1 FROM public.bookings bx WHERE bx.driver_id=d.driver_id AND bx.status IN ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT')) THEN 'AVAILABLE' ELSE 'BUSY' END)
      ORDER BY d.name)
      FROM public.drivers d LEFT JOIN public.driver_vehicle_assignments a ON a.driver_id=d.driver_id AND a.ended_at IS NULL
      LEFT JOIN public.vehicles v ON v.vehicle_id=a.vehicle_id AND v.is_active=true
      WHERE d.office_id=v_office.office_id AND d.is_active=true
    ),'[]'::jsonb),
    'office_notifications',coalesce((
      SELECT jsonb_agg(jsonb_build_object('id',n.office_notification_id,'load_order_id',n.load_order_id,'type',n.notification_type,'title',n.title,'body',n.body,'payload',n.payload,'created_at',n.created_at,'read_at',n.read_at) ORDER BY n.created_at DESC)
      FROM public.office_notifications n WHERE n.office_id=v_office.office_id
    ),'[]'::jsonb)
  );
END;
$function$;
NOTIFY pgrst, 'reload schema';
