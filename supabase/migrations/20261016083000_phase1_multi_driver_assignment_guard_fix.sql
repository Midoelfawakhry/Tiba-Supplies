-- Allow a vehicle to have multiple active driver links.
-- Keep one active vehicle per driver and prevent overlapping bookings separately.
CREATE OR REPLACE FUNCTION public.main_office_create_driver(
  p_name text,
  p_phone text,
  p_driver_code text,
  p_vehicle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_actor uuid;
  v_office uuid;
  v_id uuid;
  v_code text;
  v_name text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_vehicle public.vehicles%ROWTYPE;
BEGIN
  v_actor := public.current_main_office_user();

  IF v_name = '' OR v_phone = '' OR p_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'DRIVER_NAME_PHONE_AND_VEHICLE_REQUIRED';
  END IF;
  IF v_phone !~ '^(01[0125][0-9]{8}|\+?20(10|11|12|15)[0-9]{8}|00?20(10|11|12|15)[0-9]{8})$' THEN
    RAISE EXCEPTION 'DRIVER_PHONE_INVALID';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE regexp_replace(coalesce(d.phone, ''), '[^0-9]', '', 'g') =
          regexp_replace(v_phone, '[^0-9]', '', 'g')
  ) THEN
    RAISE EXCEPTION 'DRIVER_PHONE_EXISTS';
  END IF;

  SELECT office_id INTO v_office
  FROM public.offices
  WHERE office_code = 'RAS_SEDR' AND office_type = 'BRANCH' AND is_active = true;
  IF v_office IS NULL THEN
    RAISE EXCEPTION 'RAS_SEDR_BRANCH_CONFIGURATION_INVALID';
  END IF;

  SELECT * INTO v_vehicle
  FROM public.vehicles
  WHERE vehicle_id = p_vehicle_id AND is_active = true
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VEHICLE_NOT_AVAILABLE'; END IF;
  IF v_vehicle.office_id <> v_office THEN
    RAISE EXCEPTION 'VEHICLE_NOT_AVAILABLE_IN_TARGET_BRANCH';
  END IF;

  v_code := coalesce(
    nullif(trim(coalesce(p_driver_code, '')), ''),
    'DR-' || lpad(nextval('public.driver_code_seq')::text, 6, '0')
  );
  IF EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE lower(btrim(d.driver_code)) = lower(v_code)
  ) THEN
    RAISE EXCEPTION 'DRIVER_CODE_EXISTS';
  END IF;

  INSERT INTO public.drivers(driver_code, name, phone, office_id, is_active)
  VALUES (v_code, v_name, v_phone, v_office, true)
  RETURNING driver_id INTO v_id;

  -- Multiple active drivers may share this vehicle. Each driver still has one active link.
  INSERT INTO public.driver_vehicle_assignments(driver_id, vehicle_id, assigned_by)
  VALUES (v_id, p_vehicle_id, v_actor);

  PERFORM public.write_audit_event(
    'CREATE_DRIVER', 'DRIVER', v_id,
    jsonb_build_object('driver_code', v_code, 'name', v_name, 'phone', v_phone, 'vehicle_id', p_vehicle_id)
  );
  PERFORM public.write_audit_event(
    'ASSIGN_DRIVER_VEHICLE', 'DRIVER_VEHICLE_ASSIGNMENT', v_id,
    jsonb_build_object('vehicle_id', p_vehicle_id)
  );

  RETURN jsonb_build_object(
    'success', true, 'driver_id', v_id, 'driver_code', v_code,
    'name', v_name, 'phone', v_phone, 'vehicle_id', p_vehicle_id
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.main_office_update_driver(
  p_driver_id uuid,
  p_name text,
  p_phone text,
  p_driver_code text,
  p_vehicle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_actor uuid;
  v_office uuid;
  v_driver public.drivers%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_name text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_code text := nullif(trim(coalesce(p_driver_code, '')), '');
  v_old_vehicle uuid;
BEGIN
  v_actor := public.current_main_office_user();

  IF p_driver_id IS NULL OR v_name = '' OR v_phone = '' OR p_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'DRIVER_ID_NAME_PHONE_AND_VEHICLE_REQUIRED';
  END IF;
  IF v_phone !~ '^(01[0125][0-9]{8}|\+?20(10|11|12|15)[0-9]{8}|00?20(10|11|12|15)[0-9]{8})$' THEN
    RAISE EXCEPTION 'DRIVER_PHONE_INVALID';
  END IF;

  SELECT office_id INTO v_office
  FROM public.offices
  WHERE office_code = 'RAS_SEDR' AND office_type = 'BRANCH' AND is_active = true;
  IF v_office IS NULL THEN RAISE EXCEPTION 'RAS_SEDR_BRANCH_CONFIGURATION_INVALID'; END IF;

  SELECT * INTO v_driver
  FROM public.drivers
  WHERE driver_id = p_driver_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DRIVER_NOT_FOUND'; END IF;
  IF v_driver.office_id <> v_office THEN RAISE EXCEPTION 'DRIVER_NOT_ASSIGNED_TO_RAS_SEDR'; END IF;
  IF v_driver.auth_user_id IS NOT NULL AND v_phone IS DISTINCT FROM v_driver.phone THEN
    RAISE EXCEPTION 'DRIVER_LOGIN_PHONE_CHANGE_REQUIRES_ACCOUNT_UPDATE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.driver_id <> p_driver_id
      AND regexp_replace(coalesce(d.phone, ''), '[^0-9]', '', 'g') =
          regexp_replace(v_phone, '[^0-9]', '', 'g')
  ) THEN RAISE EXCEPTION 'DRIVER_PHONE_EXISTS'; END IF;

  SELECT * INTO v_vehicle
  FROM public.vehicles
  WHERE vehicle_id = p_vehicle_id AND is_active = true
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VEHICLE_NOT_AVAILABLE'; END IF;
  IF v_vehicle.office_id <> v_office THEN RAISE EXCEPTION 'VEHICLE_NOT_AVAILABLE_IN_TARGET_BRANCH'; END IF;

  SELECT vehicle_id INTO v_old_vehicle
  FROM public.driver_vehicle_assignments
  WHERE driver_id = p_driver_id AND ended_at IS NULL
  FOR UPDATE;

  IF v_old_vehicle IS DISTINCT FROM p_vehicle_id THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE driver_id = p_driver_id
        AND status IN ('ASSIGNED', 'ARRIVED', 'LOADING', 'LOADED', 'IN_TRANSIT')
    ) THEN RAISE EXCEPTION 'DRIVER_HAS_ACTIVE_BOOKING'; END IF;

    -- Intentionally do not reject a target vehicle merely because other drivers are linked to it.
    -- The booking-level unique guard remains responsible for preventing overlapping trips.
    UPDATE public.driver_vehicle_assignments
    SET ended_at = now()
    WHERE driver_id = p_driver_id AND ended_at IS NULL;

    INSERT INTO public.driver_vehicle_assignments(driver_id, vehicle_id, assigned_by)
    VALUES (p_driver_id, p_vehicle_id, v_actor);

    PERFORM public.write_audit_event(
      'REASSIGN_DRIVER_VEHICLE', 'DRIVER_VEHICLE_ASSIGNMENT', p_driver_id,
      jsonb_build_object('previous_vehicle_id', v_old_vehicle, 'vehicle_id', p_vehicle_id)
    );
  END IF;

  UPDATE public.drivers
  SET name = v_name,
      phone = v_phone,
      driver_code = coalesce(v_code, driver_code),
      updated_at = now()
  WHERE driver_id = p_driver_id;

  PERFORM public.write_audit_event(
    'UPDATE_DRIVER', 'DRIVER', p_driver_id,
    jsonb_build_object(
      'name', v_name,
      'phone_changed', v_driver.phone IS DISTINCT FROM v_phone,
      'driver_code', coalesce(v_code, v_driver.driver_code),
      'vehicle_id', p_vehicle_id
    )
  );

  RETURN jsonb_build_object('success', true, 'driver_id', p_driver_id, 'vehicle_id', p_vehicle_id);
END
$function$;

REVOKE ALL ON FUNCTION public.main_office_create_driver(text, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.main_office_update_driver(uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.main_office_create_driver(text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.main_office_update_driver(uuid, text, text, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
