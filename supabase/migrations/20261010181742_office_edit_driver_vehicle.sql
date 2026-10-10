-- Allow office users to correct driver and vehicle records without deleting history.
-- All operations are restricted to authenticated office roles and keep assignment rows as history.

CREATE OR REPLACE FUNCTION public.get_vehicle_owner_directory()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_uid AND au.is_active = true
      AND r.name IN ('ADMIN', 'HEAD_OFFICE', 'BRANCH')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'owner_id', vo.owner_id,
      'name', vo.name,
      'phone', vo.phone,
      'is_active', vo.is_active
    ) ORDER BY vo.name)
    FROM public.vehicle_owners vo
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_vehicle_owner_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_owner_directory() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_driver_edit_options(p_driver_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_current_vehicle_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_uid AND au.is_active = true
      AND r.name IN ('ADMIN', 'HEAD_OFFICE', 'BRANCH')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE driver_id = p_driver_id AND is_active = true) THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND_OR_INACTIVE';
  END IF;

  SELECT vda.vehicle_id INTO v_current_vehicle_id
  FROM public.vehicle_driver_assignments vda
  WHERE vda.driver_id = p_driver_id AND vda.assigned_to IS NULL AND vda.assigned_from <= now()
  ORDER BY vda.assigned_from DESC LIMIT 1;

  RETURN jsonb_build_object(
    'current_vehicle_id', v_current_vehicle_id,
    'vehicles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'vehicle_id', v.vehicle_id,
        'plate_number', v.plate_number,
        'vehicle_code', v.vehicle_code,
        'owner_name', vo.name
      ) ORDER BY v.plate_number)
      FROM public.vehicles v
      LEFT JOIN public.vehicle_owners vo ON vo.owner_id = v.owner_id
      WHERE v.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM public.vehicle_driver_assignments other_assignment
          WHERE other_assignment.vehicle_id = v.vehicle_id
            AND other_assignment.assigned_to IS NULL
            AND other_assignment.assigned_from <= now()
            AND other_assignment.driver_id <> p_driver_id
        )
    ), '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_driver_edit_options(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_driver_edit_options(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_operational_driver(
  p_driver_id uuid,
  p_name text,
  p_phone text,
  p_driver_code text,
  p_vehicle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_driver public.drivers%ROWTYPE;
  v_assignment public.vehicle_driver_assignments%ROWTYPE;
  v_target_vehicle public.vehicles%ROWTYPE;
  v_name text := NULLIF(btrim(p_name), '');
  v_phone text := NULLIF(btrim(p_phone), '');
  v_code text := NULLIF(btrim(p_driver_code), '');
  v_digits text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_uid AND au.is_active = true
      AND r.name IN ('ADMIN', 'HEAD_OFFICE', 'BRANCH')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;

  IF v_name IS NULL OR v_phone IS NULL THEN RAISE EXCEPTION 'REQUIRED_FIELDS_MISSING'; END IF;
  v_digits := regexp_replace(v_phone, '\D', '', 'g');
  IF v_digits = '' THEN RAISE EXCEPTION 'DRIVER_PHONE_INVALID'; END IF;

  SELECT * INTO v_driver FROM public.drivers
  WHERE driver_id = p_driver_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DRIVER_NOT_FOUND_OR_INACTIVE'; END IF;

  IF v_driver.auth_user_id IS NOT NULL
     AND regexp_replace(COALESCE(v_driver.phone, ''), '\D', '', 'g') <> v_digits THEN
    RAISE EXCEPTION 'DRIVER_LOGIN_PHONE_CHANGE_REQUIRES_ACCOUNT_UPDATE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.driver_id <> p_driver_id
      AND regexp_replace(COALESCE(d.phone, ''), '\D', '', 'g') = v_digits
  ) THEN RAISE EXCEPTION 'DRIVER_PHONE_EXISTS'; END IF;

  IF v_code IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.driver_id <> p_driver_id AND lower(btrim(d.driver_code)) = lower(v_code)
  ) THEN RAISE EXCEPTION 'DRIVER_CODE_EXISTS'; END IF;

  IF p_vehicle_id IS NOT NULL THEN
    SELECT * INTO v_target_vehicle
    FROM public.vehicles v
    WHERE v.vehicle_id = p_vehicle_id AND v.is_active = true
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'VEHICLE_NOT_AVAILABLE'; END IF;
  END IF;

  IF p_vehicle_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.vehicle_driver_assignments a
    WHERE a.vehicle_id = p_vehicle_id AND a.driver_id <> p_driver_id
      AND a.assigned_to IS NULL AND a.assigned_from <= now()
  ) THEN RAISE EXCEPTION 'VEHICLE_ALREADY_ASSIGNED'; END IF;

  SELECT * INTO v_assignment
  FROM public.vehicle_driver_assignments a
  WHERE a.driver_id = p_driver_id AND a.vehicle_id = p_vehicle_id
    AND a.assigned_to IS NULL AND a.assigned_from <= now()
  ORDER BY a.assigned_from DESC LIMIT 1 FOR UPDATE;

  IF p_vehicle_id IS NULL OR v_assignment.assignment_id IS NULL THEN
    UPDATE public.vehicle_driver_assignments
    SET assigned_to = now()
    WHERE driver_id = p_driver_id AND assigned_to IS NULL AND assigned_from <= now();
    IF p_vehicle_id IS NOT NULL THEN
      INSERT INTO public.vehicle_driver_assignments(driver_id, vehicle_id, assigned_from)
      VALUES (p_driver_id, p_vehicle_id, now());
    END IF;
  ELSE
    UPDATE public.vehicle_driver_assignments
    SET assigned_to = now()
    WHERE driver_id = p_driver_id AND assigned_to IS NULL AND assigned_from <= now()
      AND assignment_id <> v_assignment.assignment_id;
  END IF;

  UPDATE public.drivers
  SET name = v_name, phone = v_phone, driver_code = v_code
  WHERE driver_id = p_driver_id;

  RETURN jsonb_build_object('success', true, 'driver_id', p_driver_id, 'vehicle_id', p_vehicle_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_operational_driver(uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_operational_driver(uuid, text, text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_operational_vehicle(
  p_vehicle_id uuid,
  p_plate_number text,
  p_vehicle_code text,
  p_owner_id uuid,
  p_new_owner_name text,
  p_new_owner_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_vehicle public.vehicles%ROWTYPE;
  v_owner_id uuid := p_owner_id;
  v_plate text := NULLIF(btrim(p_plate_number), '');
  v_code text := NULLIF(btrim(p_vehicle_code), '');
  v_owner_name text := NULLIF(btrim(p_new_owner_name), '');
  v_owner_phone text := NULLIF(btrim(p_new_owner_phone), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_uid AND au.is_active = true
      AND r.name IN ('ADMIN', 'HEAD_OFFICE', 'BRANCH')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;

  IF v_plate IS NULL THEN RAISE EXCEPTION 'VEHICLE_PLATE_REQUIRED'; END IF;

  SELECT * INTO v_vehicle FROM public.vehicles
  WHERE vehicle_id = p_vehicle_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VEHICLE_NOT_FOUND_OR_INACTIVE'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.vehicle_id <> p_vehicle_id AND lower(btrim(v.plate_number)) = lower(v_plate)
  ) THEN RAISE EXCEPTION 'VEHICLE_PLATE_EXISTS'; END IF;

  IF v_code IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.vehicle_id <> p_vehicle_id AND lower(btrim(v.vehicle_code)) = lower(v_code)
  ) THEN RAISE EXCEPTION 'VEHICLE_CODE_EXISTS'; END IF;

  IF v_owner_name IS NOT NULL THEN
    IF p_owner_id IS NOT NULL THEN RAISE EXCEPTION 'OWNER_SELECTION_CONFLICT'; END IF;
    SELECT vo.owner_id INTO v_owner_id
    FROM public.vehicle_owners vo
    WHERE vo.is_active = true AND lower(btrim(vo.name)) = lower(v_owner_name)
      AND ((v_owner_phone IS NULL AND vo.phone IS NULL) OR vo.phone = v_owner_phone)
    ORDER BY vo.owner_id LIMIT 1;
    IF v_owner_id IS NULL THEN
      INSERT INTO public.vehicle_owners(name, phone, is_active)
      VALUES (v_owner_name, v_owner_phone, true)
      RETURNING owner_id INTO v_owner_id;
    END IF;
  ELSIF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'OWNER_REQUIRED';
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.vehicle_owners vo
    WHERE vo.owner_id = p_owner_id AND vo.is_active = true
  ) THEN
    RAISE EXCEPTION 'OWNER_NOT_FOUND_OR_INACTIVE';
  END IF;

  UPDATE public.vehicles
  SET plate_number = v_plate, vehicle_code = v_code, owner_id = v_owner_id
  WHERE vehicle_id = p_vehicle_id;

  RETURN jsonb_build_object('success', true, 'vehicle_id', p_vehicle_id, 'owner_id', v_owner_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_operational_vehicle(uuid, text, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_operational_vehicle(uuid, text, text, uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
