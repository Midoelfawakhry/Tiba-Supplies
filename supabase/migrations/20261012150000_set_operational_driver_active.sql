-- Office-only driver activation/deactivation with active-booking protection and audit history.
CREATE OR REPLACE FUNCTION public.set_operational_driver_active(
  p_driver_id uuid,
  p_is_active boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth uuid := auth.uid();
  v_actor uuid;
  v_driver public.drivers%ROWTYPE;
BEGIN
  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT au.user_id INTO v_actor
  FROM public.app_users au
  JOIN public.user_roles ur ON ur.user_id = au.user_id
  JOIN public.roles r ON r.role_id = ur.role_id
  WHERE au.auth_user_id = v_auth
    AND au.is_active = true
    AND r.name IN ('ADMIN', 'HEAD_OFFICE')
  LIMIT 1;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE';
  END IF;

  IF p_is_active IS NULL OR p_driver_id IS NULL THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND';
  END IF;

  SELECT * INTO v_driver
  FROM public.drivers
  WHERE driver_id = p_driver_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND';
  END IF;

  IF p_is_active = false AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.driver_id = p_driver_id
      AND b.status IN ('BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT')
  ) THEN
    RAISE EXCEPTION 'DRIVER_HAS_ACTIVE_BOOKING';
  END IF;

  UPDATE public.drivers
  SET is_active = p_is_active
  WHERE driver_id = p_driver_id;

  INSERT INTO public.audit_log (
    actor_user_id, action, entity_type, entity_id, old_data, new_data
  ) VALUES (
    v_actor,
    CASE WHEN p_is_active THEN 'DRIVER_ACTIVATED' ELSE 'DRIVER_DEACTIVATED' END,
    'driver',
    p_driver_id::text,
    jsonb_build_object('name', v_driver.name, 'is_active', v_driver.is_active),
    jsonb_build_object('name', v_driver.name, 'is_active', p_is_active)
  );

  RETURN jsonb_build_object(
    'success', true,
    'driver_id', p_driver_id,
    'is_active', p_is_active
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.set_operational_driver_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_operational_driver_active(uuid, boolean) TO authenticated;
