-- Least-privilege lookup for the direct-assignment screen to display the code it just created.
-- Avoid exposing general table reads through the client wrapper.
CREATE OR REPLACE FUNCTION public.get_direct_assignment_trip_identity(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_result jsonb;
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
      AND r.name IN ('ADMIN', 'HEAD_OFFICE', 'BRANCH')
  ) THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE';
  END IF;

  SELECT jsonb_build_object(
    'trip_code', b.trip_code,
    'assignment_daily_number', b.assignment_daily_number
  )
  INTO v_result
  FROM public.bookings b
  JOIN public.standalone_direct_load_audit a
    ON a.booking_id = b.booking_id
  WHERE b.booking_id = p_booking_id
    AND a.assigned_by_auth_user_id = v_auth_user_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'DIRECT_ASSIGNMENT_NOT_FOUND_OR_NOT_OWNED';
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_direct_assignment_trip_identity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_direct_assignment_trip_identity(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
