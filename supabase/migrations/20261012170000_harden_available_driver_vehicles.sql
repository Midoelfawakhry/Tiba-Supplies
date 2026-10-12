-- Harden the driver vehicle picker: only an authenticated, active driver account
-- may see vehicles that are currently unassigned. Existing assignments are untouched.
CREATE OR REPLACE FUNCTION public.get_available_driver_vehicles()
RETURNS TABLE(vehicle_id uuid, plate_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.auth_user_id = v_auth_user_id
      AND d.is_active = true
  ) THEN
    RAISE EXCEPTION 'DRIVER_ACCOUNT_NOT_LINKED';
  END IF;

  RETURN QUERY
  SELECT v.vehicle_id, v.plate_number::text
  FROM public.vehicles v
  WHERE v.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.vehicle_driver_assignments vda
      WHERE vda.vehicle_id = v.vehicle_id
        AND vda.assigned_to IS NULL
    )
  ORDER BY v.plate_number;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_available_driver_vehicles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_driver_vehicles() TO authenticated;

NOTIFY pgrst, 'reload schema';
