-- Phase 1: ensure Main Office cannot create a Ras Sedr driver linked to a vehicle from another office.
CREATE OR REPLACE FUNCTION public.main_office_create_driver(
  p_name text,
  p_phone text,
  p_driver_code text,
  p_vehicle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_actor uuid;
  v_office uuid;
  v_id uuid;
  v_code text;
  v_name text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
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
  WHERE office_code = 'RAS_SEDR' AND office_type = 'BRANCH' AND is_active;
  IF v_office IS NULL THEN
    RAISE EXCEPTION 'RAS_SEDR_BRANCH_CONFIGURATION_INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.vehicle_id = p_vehicle_id AND v.is_active = true AND v.office_id = v_office
  ) THEN
    RAISE EXCEPTION 'VEHICLE_NOT_AVAILABLE_IN_TARGET_BRANCH';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.driver_vehicle_assignments a
    WHERE a.vehicle_id = p_vehicle_id AND a.ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'VEHICLE_ALREADY_ASSIGNED';
  END IF;
  v_code := coalesce(nullif(trim(coalesce(p_driver_code, '')), ''), 'DR-' || lpad(nextval('public.driver_code_seq')::text, 6, '0'));
  INSERT INTO public.drivers(driver_code, name, phone, office_id, is_active)
  VALUES (v_code, v_name, v_phone, v_office, true)
  RETURNING driver_id INTO v_id;
  INSERT INTO public.driver_vehicle_assignments(driver_id, vehicle_id, assigned_by)
  VALUES (v_id, p_vehicle_id, v_actor);
  PERFORM public.write_audit_event('CREATE_DRIVER', 'DRIVER', v_id,
    jsonb_build_object('driver_code', v_code, 'name', v_name, 'phone', v_phone, 'vehicle_id', p_vehicle_id));
  PERFORM public.write_audit_event('ASSIGN_DRIVER_VEHICLE', 'DRIVER_VEHICLE_ASSIGNMENT', v_id,
    jsonb_build_object('vehicle_id', p_vehicle_id));
  RETURN jsonb_build_object('success', true, 'driver_id', v_id, 'driver_code', v_code,
    'name', v_name, 'phone', v_phone, 'vehicle_id', p_vehicle_id);
END
$function$;
