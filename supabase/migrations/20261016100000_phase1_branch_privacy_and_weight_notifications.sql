-- Phase 1 hardening: keep pending direct offers private from the Ras Sedr branch,
-- and notify both office workspaces once a booking's actual weight is first recorded.
-- Shadow only until migration reconciliation and release validation are complete.

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
  SELECT * INTO v_office
  FROM public.offices
  WHERE office_code='RAS_SEDR' AND office_type='BRANCH' AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'BRANCH_OFFICE_INACTIVE'; END IF;

  RETURN jsonb_build_object(
    'office', jsonb_build_object(
      'office_id',v_office.office_id,'office_code',v_office.office_code,
      'name',v_office.name,'latitude',v_office.latitude,'longitude',v_office.longitude,
      'geofence_radius_m',v_office.geofence_radius_m
    ),
    'available_loads', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'load_order_id',lo.load_order_id,'order_number',lo.order_number,
        'factory_id',f.factory_id,'factory_name',f.name,'quarry_id',q.quarry_id,
        'quarry_name',q.name,'requested_quantity',lo.requested_quantity,
        'committed_quantity',coalesce(x.committed_quantity,0),'priority',lo.priority,
        'status',lo.status,'created_at',lo.created_at,'published_at',lo.published_at,'notes',lo.notes
      ) ORDER BY lo.priority ASC,lo.created_at ASC)
      FROM public.load_orders lo
      JOIN public.factories f ON f.factory_id=lo.factory_id
      JOIN public.quarries q ON q.quarry_id=lo.quarry_id
      LEFT JOIN LATERAL (
        SELECT count(*)::integer AS committed_quantity
        FROM public.bookings b
        WHERE b.load_order_id=lo.load_order_id AND b.status<>'CANCELLED'
      ) x ON true
      WHERE lo.status IN ('PUBLISHED','IN_PROGRESS')
        AND NOT EXISTS (
          SELECT 1 FROM public.bookings pending
          WHERE pending.load_order_id=lo.load_order_id
            AND pending.assignment_type='DIRECT'
            AND pending.direct_acceptance_status='PENDING'
            AND pending.status='ASSIGNED'
        )
    ),'[]'::jsonb),
    'allocations', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'booking_id',b.booking_id,'load_order_id',b.load_order_id,'order_number',lo.order_number,
        'driver_id',d.driver_id,'driver_name',d.name,'driver_code',d.driver_code,'driver_phone',d.phone,
        'vehicle_id',v.vehicle_id,'plate_number',v.plate_number,'vehicle_code',v.vehicle_code,
        'factory_name',f.name,'quarry_name',q.name,'trip_code',b.trip_code,'status',b.status,
        'assignment_type',b.assignment_type,'assigned_at',b.assigned_at,'arrived_at',b.arrived_at
      ) ORDER BY b.assigned_at DESC)
      FROM public.bookings b
      JOIN public.drivers d ON d.driver_id=b.driver_id
      JOIN public.vehicles v ON v.vehicle_id=b.vehicle_id
      JOIN public.load_orders lo ON lo.load_order_id=b.load_order_id
      JOIN public.factories f ON f.factory_id=lo.factory_id
      JOIN public.quarries q ON q.quarry_id=lo.quarry_id
      WHERE d.office_id=v_office.office_id AND v.office_id=v_office.office_id
        AND NOT (b.assignment_type='DIRECT' AND b.direct_acceptance_status='PENDING' AND b.status='ASSIGNED')
    ),'[]'::jsonb),
    'actual_loading_records', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'actual_load_id',al.actual_load_id,'booking_id',al.booking_id,
        'actual_weight',al.actual_weight,'ticket_number',al.ticket_number,'loaded_at',al.loaded_at,
        'notes',al.notes,'driver_name',d.name,'plate_number',v.plate_number,
        'factory_name',f.name,'quarry_name',q.name,'trip_code',b.trip_code,'order_number',lo.order_number
      ) ORDER BY al.loaded_at DESC)
      FROM public.actual_loading_records al
      JOIN public.bookings b ON b.booking_id=al.booking_id
      JOIN public.drivers d ON d.driver_id=b.driver_id
      JOIN public.vehicles v ON v.vehicle_id=b.vehicle_id
      JOIN public.load_orders lo ON lo.load_order_id=b.load_order_id
      JOIN public.factories f ON f.factory_id=lo.factory_id
      JOIN public.quarries q ON q.quarry_id=lo.quarry_id
      WHERE d.office_id=v_office.office_id AND v.office_id=v_office.office_id
    ),'[]'::jsonb),
    'waiting_list','[]'::jsonb,
    'directory', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'driver_id',d.driver_id,'driver_code',d.driver_code,'name',d.name,'phone',d.phone,
        'is_active',d.is_active,'vehicle_id',v.vehicle_id,'plate_number',v.plate_number,
        'vehicle_code',v.vehicle_code,
        'availability',CASE WHEN d.is_active AND v.is_active AND NOT EXISTS(
          SELECT 1 FROM public.bookings bx
          WHERE bx.driver_id=d.driver_id
            AND bx.status IN ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT')
            AND NOT (bx.assignment_type='DIRECT' AND bx.direct_acceptance_status='PENDING' AND bx.status='ASSIGNED')
        ) THEN 'AVAILABLE' ELSE 'BUSY' END
      ) ORDER BY d.name)
      FROM public.drivers d
      LEFT JOIN public.driver_vehicle_assignments a ON a.driver_id=d.driver_id AND a.ended_at IS NULL
      LEFT JOIN public.vehicles v ON v.vehicle_id=a.vehicle_id AND v.is_active=true
      WHERE d.office_id=v_office.office_id AND d.is_active=true
    ),'[]'::jsonb),
    'office_notifications', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',n.office_notification_id,'load_order_id',n.load_order_id,'type',n.notification_type,
        'title',n.title,'body',n.body,'payload',n.payload,'created_at',n.created_at,'read_at',n.read_at
      ) ORDER BY n.created_at DESC)
      FROM public.office_notifications n WHERE n.office_id=v_office.office_id
    ),'[]'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_offices_actual_weight_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_booking public.bookings%rowtype;
  v_order public.load_orders%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_factory public.factories%rowtype;
  v_quarry public.quarries%rowtype;
  v_office record;
  v_body text;
  v_trip_code text;
BEGIN
  -- Fire only when the first positive actual weight becomes durable.
  IF NEW.actual_weight IS NULL OR NEW.actual_weight <= 0 THEN
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND OLD.actual_weight IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE booking_id=NEW.booking_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT * INTO v_order FROM public.load_orders WHERE load_order_id=v_booking.load_order_id;
  SELECT * INTO v_vehicle FROM public.vehicles WHERE vehicle_id=v_booking.vehicle_id;
  SELECT * INTO v_factory FROM public.factories WHERE factory_id=v_order.factory_id;
  SELECT * INTO v_quarry FROM public.quarries WHERE quarry_id=v_order.quarry_id;
  v_trip_code := coalesce(nullif(v_booking.trip_code,''),v_order.order_number::text);
  v_body := format(
    'تم تسجيل وتأكيد الوزن الفعلي للنقلة %s. الوزن: %s طن. العربية: %s. المصنع: %s. المحجر: %s.',
    v_trip_code, NEW.actual_weight::text, coalesce(v_vehicle.plate_number,'غير محدد'),
    coalesce(v_factory.name,'غير محدد'), coalesce(v_quarry.name,'غير محدد')
  );

  FOR v_office IN
    SELECT office_id FROM public.offices
    WHERE is_active=true AND office_code IN ('MAIN','RAS_SEDR')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.office_notifications n
      WHERE n.office_id=v_office.office_id
        AND n.notification_type='ACTUAL_WEIGHT_CONFIRMED'
        AND n.payload->>'booking_id'=NEW.booking_id::text
    ) THEN
      INSERT INTO public.office_notifications(
        office_id,load_order_id,notification_type,title,body,payload
      ) VALUES (
        v_office.office_id,v_booking.load_order_id,'ACTUAL_WEIGHT_CONFIRMED',
        'تأكيد الوزن الفعلي',v_body,
        jsonb_build_object(
          'booking_id',NEW.booking_id,'actual_load_id',NEW.actual_load_id,
          'trip_code',v_trip_code,'actual_weight',NEW.actual_weight,
          'plate_number',v_vehicle.plate_number,'factory_name',v_factory.name,
          'quarry_name',v_quarry.name,'confirmed_at',coalesce(NEW.loaded_at,now())
        )
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_offices_actual_weight_confirmed ON public.actual_loading_records;
CREATE TRIGGER trg_notify_offices_actual_weight_confirmed
AFTER INSERT OR UPDATE OF actual_weight ON public.actual_loading_records
FOR EACH ROW
EXECUTE FUNCTION public.notify_offices_actual_weight_confirmed();

REVOKE ALL ON FUNCTION public.notify_offices_actual_weight_confirmed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_offices_actual_weight_confirmed() TO service_role;

NOTIFY pgrst, 'reload schema';
