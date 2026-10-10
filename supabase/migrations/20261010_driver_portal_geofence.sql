-- Driver portal: enforce the 10 km gate server-side and return only this driver's operational data.
CREATE OR REPLACE FUNCTION public.get_driver_portal_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_driver_id uuid;
  v_vehicle_id uuid;
  v_office public.offices%ROWTYPE;
  v_loc public.driver_live_locations%ROWTYPE;
  v_distance_m double precision;
  v_wait_entry public.waiting_list_entries%ROWTYPE;
  v_position integer;
  v_inside boolean := false;
BEGIN
  IF v_auth_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT d.driver_id INTO v_driver_id
  FROM public.drivers d
  WHERE d.auth_user_id = v_auth_user_id AND d.is_active = true
  LIMIT 1;
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'DRIVER_ACCOUNT_NOT_LINKED'; END IF;

  SELECT vda.vehicle_id INTO v_vehicle_id
  FROM public.vehicle_driver_assignments vda
  JOIN public.vehicles v ON v.vehicle_id = vda.vehicle_id AND v.is_active = true
  WHERE vda.driver_id = v_driver_id
    AND vda.assigned_to IS NULL AND vda.assigned_from <= now()
  ORDER BY vda.assigned_from DESC LIMIT 1;

  SELECT * INTO v_office FROM public.offices
  WHERE office_type = 'BRANCH' AND is_active = true
  ORDER BY name LIMIT 1;

  SELECT * INTO v_loc FROM public.driver_live_locations
  WHERE driver_id = v_driver_id
  ORDER BY updated_at DESC LIMIT 1;

  IF v_office.office_id IS NOT NULL
    AND v_office.latitude IS NOT NULL AND v_office.longitude IS NOT NULL
    AND v_loc.driver_id IS NOT NULL
    AND v_loc.updated_at >= now() - interval '10 minutes' THEN
    v_distance_m := 2 * 6371000 * asin(sqrt(
      power(sin(radians(v_loc.latitude - v_office.latitude) / 2), 2) +
      cos(radians(v_office.latitude)) * cos(radians(v_loc.latitude)) *
      power(sin(radians(v_loc.longitude - v_office.longitude) / 2), 2)
    ));
    v_inside := v_distance_m <= 10000;
  END IF;

  IF v_inside THEN
    SELECT * INTO v_wait_entry FROM public.waiting_list_entries
    WHERE driver_id = v_driver_id AND office_id = v_office.office_id
      AND status = 'WAITING'
    ORDER BY arrived_at DESC LIMIT 1;

    IF v_wait_entry.entry_id IS NOT NULL THEN
      SELECT COUNT(*)::integer + 1 INTO v_position
      FROM public.waiting_list_entries w
      WHERE w.office_id = v_office.office_id AND w.status = 'WAITING'
        AND w.arrived_at < v_wait_entry.arrived_at;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'inside_geofence', v_inside,
    'distance_m', v_distance_m,
    'radius_m', 10000,
    'location_updated_at', v_loc.updated_at,
    'office_name', v_office.name,
    'office_id', v_office.office_id,
    'driver_id', v_driver_id,
    'vehicle_id', v_vehicle_id,
    'queue_status', CASE WHEN NOT v_inside THEN 'OUTSIDE' WHEN v_wait_entry.entry_id IS NOT NULL THEN 'WAITING' ELSE 'NOT_REGISTERED' END,
    'queue_position', v_position,
    'available_loads', CASE WHEN v_inside THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'load_order_id', lo.load_order_id,
        'status', lo.status,
        'requested_quantity', lo.requested_quantity,
        'created_at', lo.created_at,
        'factory_name', f.name,
        'quarry_name', q.name,
        'committed_quantity', (SELECT COUNT(*) FROM public.bookings b WHERE b.load_order_id = lo.load_order_id AND b.status IN ('BOOKED','LOADING_STATEMENT','IN_TRANSIT','DELIVERED','COMPLETED')),
        'remaining_quantity', GREATEST(0, lo.requested_quantity - (SELECT COUNT(*) FROM public.bookings b WHERE b.load_order_id = lo.load_order_id AND b.status IN ('BOOKED','LOADING_STATEMENT','IN_TRANSIT','DELIVERED','COMPLETED')))
      ) ORDER BY lo.created_at DESC)
      FROM public.load_orders lo
      LEFT JOIN public.factories f ON f.factory_id = lo.factory_id
      LEFT JOIN public.quarries q ON q.quarry_id = lo.quarry_id
      WHERE lo.check_in_office_id = v_office.office_id
        AND lo.status IN ('PUBLISHED','LOADING_STATEMENT')
        AND (SELECT COUNT(*) FROM public.bookings b WHERE b.load_order_id = lo.load_order_id AND b.status IN ('BOOKED','LOADING_STATEMENT','IN_TRANSIT','DELIVERED','COMPLETED')) < lo.requested_quantity
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'my_bookings', CASE WHEN v_inside THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'booking_id', b.booking_id, 'status', b.status, 'booked_at', b.booked_at,
        'load_order_id', lo.load_order_id, 'factory_name', f.name, 'quarry_name', q.name,
        'requested_quantity', lo.requested_quantity
      ) ORDER BY b.booked_at DESC)
      FROM public.bookings b
      JOIN public.load_orders lo ON lo.load_order_id = b.load_order_id
      LEFT JOIN public.factories f ON f.factory_id = lo.factory_id
      LEFT JOIN public.quarries q ON q.quarry_id = lo.quarry_id
      WHERE b.driver_id = v_driver_id
    ), '[]'::jsonb) ELSE '[]'::jsonb END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_driver_portal_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_driver_portal_snapshot() TO authenticated;
NOTIFY pgrst, 'reload schema';
