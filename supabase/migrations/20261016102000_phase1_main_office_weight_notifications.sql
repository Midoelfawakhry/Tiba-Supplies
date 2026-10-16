-- Surface actual-weight confirmations in the Main Office snapshot as well as the branch snapshot.
CREATE OR REPLACE FUNCTION public.main_office_get_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := public.current_main_office_user();
  RETURN jsonb_build_object(
    'office',(SELECT jsonb_build_object('office_id',office_id,'office_code',office_code,'name',name,'office_type',office_type,'latitude',latitude,'longitude',longitude,'geofence_radius_m',geofence_radius_m) FROM public.offices WHERE office_code='MAIN' AND office_type='HEAD_OFFICE' AND is_active=true),
    'operational_office',(SELECT jsonb_build_object('office_id',office_id,'office_code',office_code,'name',name,'office_type',office_type) FROM public.offices WHERE office_code='MAIN' AND office_type='HEAD_OFFICE' AND is_active=true),
    'check_in_office',(SELECT jsonb_build_object('office_id',office_id,'office_code',office_code,'name',name,'office_type',office_type,'latitude',latitude,'longitude',longitude,'geofence_radius_m',geofence_radius_m) FROM public.offices WHERE office_code='RAS_SEDR' AND office_type='BRANCH' AND is_active=true),
    'factories',(SELECT coalesce(jsonb_agg(jsonb_build_object('factory_id',factory_id,'factory_code',factory_code,'name',name,'is_active',is_active) ORDER BY name),'[]'::jsonb) FROM public.factories),
    'quarries',(SELECT coalesce(jsonb_agg(jsonb_build_object('quarry_id',quarry_id,'quarry_code',quarry_code,'name',name,'latitude',latitude,'longitude',longitude,'is_active',is_active) ORDER BY name),'[]'::jsonb) FROM public.quarries),
    'drivers',(SELECT coalesce(jsonb_agg(jsonb_build_object('driver_id',d.driver_id,'driver_code',d.driver_code,'name',d.name,'phone',d.phone,'office_id',d.office_id,'is_active',d.is_active,'latitude',l.latitude,'longitude',l.longitude,'location_captured_at',l.captured_at,'location_received_at',l.received_at) ORDER BY d.name),'[]'::jsonb) FROM public.drivers d LEFT JOIN public.driver_live_locations l ON l.driver_id=d.driver_id),
    'vehicles',(SELECT coalesce(jsonb_agg(jsonb_build_object('vehicle_id',v.vehicle_id,'vehicle_code',v.vehicle_code,'plate_number',v.plate_number,'owner_id',v.owner_id,'office_id',v.office_id,'is_active',v.is_active) ORDER BY v.plate_number),'[]'::jsonb) FROM public.vehicles v),
    'load_orders',(SELECT coalesce(jsonb_agg(jsonb_build_object('load_order_id',lo.load_order_id,'order_number',lo.order_number,'factory_id',lo.factory_id,'factory_name',f.name,'quarry_id',lo.quarry_id,'quarry_name',q.name,'requested_quantity',lo.requested_quantity,'priority',lo.priority,'status',lo.status,'created_at',lo.created_at,'published_at',lo.published_at,'notes',lo.notes) ORDER BY lo.created_at DESC),'[]'::jsonb) FROM public.load_orders lo JOIN public.factories f ON f.factory_id=lo.factory_id JOIN public.quarries q ON q.quarry_id=lo.quarry_id),
    'bookings',(SELECT coalesce(jsonb_agg(jsonb_build_object('booking_id',b.booking_id,'load_order_id',b.load_order_id,'driver_id',b.driver_id,'driver_name',d.name,'vehicle_id',b.vehicle_id,'plate_number',v.plate_number,'assignment_type',b.assignment_type,'status',b.status,'trip_code',b.trip_code,'assigned_at',b.assigned_at,'arrived_at',b.arrived_at,'direct_acceptance_status',b.direct_acceptance_status,'direct_accepted_at',b.direct_accepted_at) ORDER BY b.assigned_at DESC),'[]'::jsonb) FROM public.bookings b JOIN public.drivers d ON d.driver_id=b.driver_id JOIN public.vehicles v ON v.vehicle_id=b.vehicle_id),
    'actual_loading_records',(SELECT coalesce(jsonb_agg(jsonb_build_object('actual_load_id',a.actual_load_id,'booking_id',a.booking_id,'actual_weight',a.actual_weight,'ticket_number',a.ticket_number,'loaded_at',a.loaded_at,'notes',a.notes) ORDER BY a.loaded_at DESC),'[]'::jsonb) FROM public.actual_loading_records a),
    'office_notifications',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',n.office_notification_id,'load_order_id',n.load_order_id,'type',n.notification_type,'title',n.title,'body',n.body,'payload',n.payload,'created_at',n.created_at,'read_at',n.read_at) ORDER BY n.created_at DESC),'[]'::jsonb) FROM (SELECT * FROM public.office_notifications WHERE office_id=(SELECT office_id FROM public.offices WHERE office_code='MAIN' AND office_type='HEAD_OFFICE' AND is_active=true) ORDER BY created_at DESC LIMIT 20) n)
  );
END;
$function$;
NOTIFY pgrst, 'reload schema';
