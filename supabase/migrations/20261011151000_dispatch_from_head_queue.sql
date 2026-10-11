-- Correct dispatch queue ownership: operational queue is HEAD; BRANCH is geofence-only.
-- Forward-only candidate; staging verification required before production rollout.
CREATE OR REPLACE FUNCTION public.dispatch_load(p_load_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_load public.load_orders%ROWTYPE;
  v_entry_id uuid;
  v_driver_id uuid;
  v_vehicle_id uuid;
  v_booking_id uuid;
  v_geofence jsonb;
  v_committed_count integer;
  v_active_count integer;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_auth_user_id
      AND au.is_active = true
      AND r.name IN ('ADMIN', 'HEAD_OFFICE')
  ) THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE';
  END IF;

  SELECT * INTO v_load
  FROM public.load_orders
  WHERE load_order_id = p_load_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOAD_ORDER_NOT_FOUND';
  END IF;

  IF v_load.status NOT IN ('PUBLISHED', 'LOADING_STATEMENT') THEN
    RAISE EXCEPTION 'LOAD_ORDER_NOT_DISPATCHABLE';
  END IF;

  IF v_load.check_in_office_id IS NULL THEN
    RAISE EXCEPTION 'CHECK_IN_OFFICE_NOT_CONFIGURED';
  END IF;

  -- Capacity is lifetime fulfilled/reserved quantity, not just currently active bookings.
  -- Cancelled/rejected/no-show/failed bookings release capacity.
  SELECT COUNT(*) INTO v_committed_count
  FROM public.bookings b
  WHERE b.load_order_id = v_load.load_order_id
    AND b.status IN (
      'BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'
    );

  IF v_committed_count >= v_load.requested_quantity THEN
    RAISE EXCEPTION 'LOAD_CAPACITY_REACHED';
  END IF;

  SELECT w.entry_id, w.driver_id, w.vehicle_id
  INTO v_entry_id, v_driver_id, v_vehicle_id
  FROM public.waiting_list_entries w
  JOIN public.drivers d
    ON d.driver_id = w.driver_id AND d.is_active = true
  JOIN public.vehicles v
    ON v.vehicle_id = w.vehicle_id AND v.is_active = true
  JOIN public.vehicle_driver_assignments vda
    ON vda.driver_id = w.driver_id
   AND vda.vehicle_id = w.vehicle_id
   AND vda.assigned_to IS NULL
   AND vda.assigned_from <= now()
  CROSS JOIN LATERAL (
    SELECT public.get_driver_geofence_status(w.driver_id) AS result
  ) geo
  WHERE w.office_id = v_load.office_id
    AND w.status = 'WAITING'
    AND geo.result->>'eligible' = 'true'
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.driver_id = w.driver_id
        AND b.status IN ('BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.vehicle_id = w.vehicle_id
        AND b.status IN ('BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT')
    )
  ORDER BY w.arrived_at
  FOR UPDATE OF w SKIP LOCKED
  LIMIT 1;

  IF v_entry_id IS NULL THEN
    RAISE EXCEPTION 'NO_ELIGIBLE_DRIVER_WAITING_IN_HEAD_QUEUE';
  END IF;

  INSERT INTO public.bookings (
    load_order_id, driver_id, vehicle_id, status, booked_at
  )
  VALUES (
    v_load.load_order_id, v_driver_id, v_vehicle_id, 'BOOKED', now()
  )
  RETURNING booking_id INTO v_booking_id;

  UPDATE public.waiting_list_entries
  SET status = 'ASSIGNED'
  WHERE entry_id = v_entry_id;

  INSERT INTO public.actual_loading_records (
    booking_id, load_date, vehicle_id, driver_id, quarry_id, factory_id, created_at
  )
  VALUES (
    v_booking_id, CURRENT_DATE, v_vehicle_id, v_driver_id,
    v_load.quarry_id, v_load.factory_id, now()
  );

  UPDATE public.bookings
  SET status = 'LOADING_STATEMENT'
  WHERE booking_id = v_booking_id;

  UPDATE public.load_orders
  SET status = 'LOADING_STATEMENT'
  WHERE load_order_id = v_load.load_order_id;

  SELECT COUNT(*) INTO v_active_count
  FROM public.bookings b
  WHERE b.load_order_id = v_load.load_order_id
    AND b.status IN ('BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT');

  RETURN jsonb_build_object(
    'success', true,
    'load_order_id', v_load.load_order_id,
    'booking_id', v_booking_id,
    'driver_id', v_driver_id,
    'vehicle_id', v_vehicle_id,
    'operational_office_id', v_load.office_id,
    'check_in_office_id', v_load.check_in_office_id,
    'requested_quantity', v_load.requested_quantity,
    'committed_quantity', v_committed_count + 1,
    'active_bookings', v_active_count,
    'remaining_quantity', GREATEST(0, v_load.requested_quantity - v_committed_count - 1),
    'status', 'LOADING_STATEMENT'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.dispatch_load(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_load(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.dispatch_load(uuid) TO authenticated;


