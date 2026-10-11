-- Office directory maintenance: edit branch employee details and safely deactivate drivers.
-- This is a forward-only migration; historical loading/assignment records are never deleted.

CREATE OR REPLACE FUNCTION public.update_branch_employee_details(
  p_user_id uuid,
  p_display_name text,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := NULLIF(btrim(p_display_name), '');
  v_phone text := NULLIF(btrim(p_phone), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_uid AND au.is_active = true
      AND r.name IN ('ADMIN', 'HEAD_OFFICE')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;
  IF v_name IS NULL OR length(v_name) < 3 THEN RAISE EXCEPTION 'DISPLAY_NAME_REQUIRED'; END IF;
  IF v_phone IS NOT NULL AND v_phone !~ '^[0-9+() -]{7,20}$' THEN RAISE EXCEPTION 'PHONE_INVALID'; END IF;

  UPDATE public.app_users au
  SET display_name = v_name, phone = v_phone
  WHERE au.user_id = p_user_id
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.role_id = ur.role_id
      WHERE ur.user_id = au.user_id AND r.name = 'BRANCH'
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'BRANCH_EMPLOYEE_NOT_FOUND'; END IF;
  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_branch_employee_details(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_branch_employee_details(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_operational_driver_active(
  p_driver_id uuid,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_driver public.drivers%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_uid AND au.is_active = true
      AND r.name IN ('ADMIN', 'HEAD_OFFICE')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;

  SELECT * INTO v_driver FROM public.drivers
  WHERE driver_id = p_driver_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DRIVER_NOT_FOUND'; END IF;

  IF p_is_active = false THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.driver_id = p_driver_id
        AND b.status NOT IN ('CANCELLED','REJECTED','NO_SHOW','FAILED','DELIVERED','COMPLETED')
    ) THEN
      RAISE EXCEPTION 'DRIVER_HAS_ACTIVE_BOOKING';
    END IF;
    UPDATE public.vehicle_driver_assignments
    SET assigned_to = now()
    WHERE driver_id = p_driver_id
      AND assigned_to IS NULL
      AND assigned_from <= now();
  END IF;

  UPDATE public.drivers SET is_active = p_is_active
  WHERE driver_id = p_driver_id;

  RETURN jsonb_build_object('success', true, 'driver_id', p_driver_id, 'is_active', p_is_active);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_operational_driver_active(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_operational_driver_active(uuid,boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
