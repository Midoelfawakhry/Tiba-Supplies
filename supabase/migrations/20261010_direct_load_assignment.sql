-- Direct office assignment: bypass queue order and automatic-dispatch eligibility rules.
-- The sole business eligibility gate is a fresh GPS position inside the order's check-in office geofence.
CREATE TABLE IF NOT EXISTS public.direct_load_assignment_audit (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_order_id uuid NOT NULL REFERENCES public.load_orders(load_order_id),
  booking_id uuid NOT NULL REFERENCES public.bookings(booking_id),
  driver_id uuid NOT NULL REFERENCES public.drivers(driver_id),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(vehicle_id),
  office_id uuid NOT NULL REFERENCES public.offices(office_id),
  assigned_by_auth_user_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.direct_load_assignment_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.direct_load_assignment_audit FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.direct_assign_load(
  p_load_order_id uuid,
  p_vehicle_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_load public.load_orders%ROWTYPE;
  v_office public.offices%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_driver_id uuid;
  v_location public.driver_live_locations%ROWTYPE;
  v_distance_m double precision;
  v_booking_id uuid;
  v_committed_count integer;
BEGIN
  IF v_auth_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_auth_user_id
      AND au.is_active = true
      AND r.name IN ('ADMIN', 'HEAD_OFFICE', 'BRANCH')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;

  SELECT * INTO v_load FROM public.load_orders
  WHERE load_order_id = p_load_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LOAD_ORDER_NOT_FOUND'; END IF;
  IF v_load.status NOT IN ('PUBLISHED', 'LOADING_STATEMENT') THEN
    RAISE EXCEPTION 'LOAD_ORDER_NOT_DISPATCHABLE';
  END IF;

  SELECT * INTO v_office FROM public.offices
  WHERE office_id = v_load.check_in_office_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHECK_IN_OFFICE_NOT_CONFIGURED'; END IF;
  IF v_office.latitude IS NULL OR v_office.longitude IS NULL
     OR v_office.geofence_radius_m IS NULL OR v_office.geofence_radius_m <= 0 THEN
    RAISE EXCEPTION 'OFFICE_GEOFENCE_NOT_CONFIGURED';
  END IF;

  SELECT * INTO v_vehicle FROM public.vehicles
  WHERE vehicle_id = p_vehicle_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'VEHICLE_NOT_FOUND_OR_INACTIVE'; END IF;

  -- Resolve the currently assigned driver for the selected vehicle.
  SELECT vda.driver_id INTO v_driver_id
  FROM public.vehicle_driver_assignments vda
  JOIN public.drivers d ON d.driver_id = vda.driver_id AND d.is_active = true
  WHERE vda.vehicle_id = p_vehicle_id
    AND vda.assigned_to IS NULL
    AND vda.assigned_from <= now()
  ORDER BY vda.assigned_from DESC
  LIMIT 1;
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'NO_ACTIVE_DRIVER_FOR_VEHICLE'; END IF;

  SELECT * INTO v_location
  FROM public.driver_live_locations
  WHERE driver_id = v_driver_id AND vehicle_id = p_vehicle_id;
  IF NOT FOUND OR v_location.updated_at < now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'VEHICLE_LOCATION_MISSING_OR_STALE';
  END IF;

  -- Haversine distance in meters from the office geofence center.
  v_distance_m := 2 * 6371000 * asin(sqrt(
    power(sin(radians(v_location.latitude - v_office.latitude) / 2), 2) +
    cos(radians(v_office.latitude)) * cos(radians(v_location.latitude)) *
    power(sin(radians(v_location.longitude - v_office.longitude) / 2), 2)
  ));
  IF v_distance_m > v_office.geofence_radius_m THEN
    RAISE EXCEPTION 'VEHICLE_OUTSIDE_GEOFENCE';
  END IF;

  SELECT COUNT(*) INTO v_committed_count
  FROM public.bookings b
  WHERE b.load_order_id = v_load.load_order_id
    AND b.status IN ('BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED');
  IF v_committed_count >= v_load.requested_quantity THEN RAISE EXCEPTION 'LOAD_CAPACITY_REACHED'; END IF;

  -- Preserve data integrity: a driver/vehicle cannot receive two concurrent active loads.
  IF EXISTS (SELECT 1 FROM public.bookings b
             WHERE b.driver_id = v_driver_id
               AND b.status IN ('BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT')) THEN
    RAISE EXCEPTION 'DRIVER_HAS_ACTIVE_BOOKING';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bookings b
             WHERE b.vehicle_id = p_vehicle_id
               AND b.status IN ('BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT')) THEN
    RAISE EXCEPTION 'VEHICLE_HAS_ACTIVE_BOOKING';
  END IF;

  INSERT INTO public.bookings(load_order_id, driver_id, vehicle_id, status, booked_at)
  VALUES(v_load.load_order_id, v_driver_id, p_vehicle_id, 'LOADING_STATEMENT', now())
  RETURNING booking_id INTO v_booking_id;

  INSERT INTO public.actual_loading_records(
    booking_id, load_date, vehicle_id, driver_id, quarry_id, factory_id, created_at
  ) VALUES (
    v_booking_id, CURRENT_DATE, p_vehicle_id, v_driver_id,
    v_load.quarry_id, v_load.factory_id, now()
  );

  UPDATE public.load_orders SET status = 'LOADING_STATEMENT'
  WHERE load_order_id = v_load.load_order_id;

  INSERT INTO public.direct_load_assignment_audit(
    load_order_id, booking_id, driver_id, vehicle_id, office_id, assigned_by_auth_user_id
  ) VALUES (
    v_load.load_order_id, v_booking_id, v_driver_id, p_vehicle_id,
    v_office.office_id, v_auth_user_id
  );

  RETURN jsonb_build_object(
    'success', true, 'booking_id', v_booking_id, 'load_order_id', v_load.load_order_id,
    'driver_id', v_driver_id, 'vehicle_id', p_vehicle_id,
    'distance_m', round(v_distance_m::numeric, 1),
    'geofence_radius_m', v_office.geofence_radius_m,
    'status', 'LOADING_STATEMENT'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.direct_assign_load(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direct_assign_load(uuid, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
