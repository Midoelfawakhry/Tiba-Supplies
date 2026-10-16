-- Read-only account statement source for office reporting.
-- HEAD is the only operational office; BRANCH is a geofence/check-in location, not a reporting owner.
CREATE OR REPLACE FUNCTION public.get_account_statement_records(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
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
      AND r.name IN ('ADMIN', 'HEAD_OFFICE')
  ) THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE';
  END IF;

  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
    RAISE EXCEPTION 'INVALID_DATE_RANGE';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'actual_load_id', alr.actual_load_id,
    'booking_id', alr.booking_id,
    'load_date', alr.load_date,
    'loading_sequence_date', alr.loading_sequence_date,
    'daily_load_number', alr.daily_load_number,
    'trip_code', alr.trip_code,
    'created_at', alr.created_at,
    'ticket_number', alr.ticket_number,
    'actual_weight', alr.actual_weight,
    'vehicle_id', alr.vehicle_id,
    'plate_number', v.plate_number,
    'driver_id', alr.driver_id,
    'driver_name', d.name,
    'factory_id', alr.factory_id,
    'factory_name', f.name,
    'quarry_id', alr.quarry_id,
    'quarry_name', q.name,
    'delivery_confirmed_at', alr.delivery_confirmed_at
  ) ORDER BY COALESCE(alr.load_date, alr.created_at::date) DESC, alr.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM public.actual_loading_records alr
  LEFT JOIN public.vehicles v ON v.vehicle_id = alr.vehicle_id
  LEFT JOIN public.drivers d ON d.driver_id = alr.driver_id
  LEFT JOIN public.factories f ON f.factory_id = alr.factory_id
  LEFT JOIN public.quarries q ON q.quarry_id = alr.quarry_id
  WHERE (p_from IS NULL OR COALESCE(alr.load_date, alr.created_at::date) >= p_from)
    AND (p_to IS NULL OR COALESCE(alr.load_date, alr.created_at::date) <= p_to);

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_account_statement_records(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_account_statement_records(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_account_statement_records(date, date) TO authenticated;
