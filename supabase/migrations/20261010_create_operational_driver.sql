-- Create an operational driver and vehicle record from the office app.
-- Does NOT create a Supabase Auth account; that is a separate workflow.
CREATE OR REPLACE FUNCTION public.create_operational_driver(
  p_name text,
  p_phone text,
  p_plate_number text,
  p_driver_code text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_driver_id uuid;
  v_vehicle_id uuid;
  v_user_id uuid := auth.uid();
  v_name text := NULLIF(btrim(p_name), '');
  v_phone text := NULLIF(btrim(p_phone), '');
  v_plate text := NULLIF(btrim(p_plate_number), '');
  v_code text := NULLIF(btrim(p_driver_code), '');
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_user_id AND au.is_active = true
      AND r.name IN ('ADMIN','HEAD_OFFICE','BRANCH')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;

  IF v_name IS NULL OR v_phone IS NULL OR v_plate IS NULL THEN
    RAISE EXCEPTION 'REQUIRED_FIELDS_MISSING';
  END IF;
  IF EXISTS (SELECT 1 FROM public.drivers d WHERE regexp_replace(d.phone, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')) THEN
    RAISE EXCEPTION 'DRIVER_PHONE_EXISTS';
  END IF;
  IF EXISTS (SELECT 1 FROM public.vehicles v WHERE lower(btrim(v.plate_number)) = lower(v_plate)) THEN
    RAISE EXCEPTION 'VEHICLE_PLATE_EXISTS';
  END IF;
  IF v_code IS NOT NULL AND EXISTS (SELECT 1 FROM public.drivers d WHERE lower(btrim(d.driver_code)) = lower(v_code)) THEN
    RAISE EXCEPTION 'DRIVER_CODE_EXISTS';
  END IF;

  INSERT INTO public.drivers (name, phone, driver_code, is_active, auth_user_id)
  VALUES (v_name, v_phone, v_code, true, NULL)
  RETURNING driver_id INTO v_driver_id;

  INSERT INTO public.vehicles (plate_number, is_active)
  VALUES (v_plate, true)
  RETURNING vehicle_id INTO v_vehicle_id;

  INSERT INTO public.vehicle_driver_assignments (driver_id, vehicle_id, assigned_from, assigned_to)
  VALUES (v_driver_id, v_vehicle_id, now(), NULL);

  RETURN jsonb_build_object(
    'success', true, 'driver_id', v_driver_id, 'vehicle_id', v_vehicle_id,
    'driver_name', v_name, 'phone', v_phone, 'plate_number', v_plate, 'driver_code', v_code
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_operational_driver(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_operational_driver(text,text,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
