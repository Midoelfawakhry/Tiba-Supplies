-- Include the linked vehicle owner's name in the real vehicle picker used when creating a driver.
-- This is read-only data enrichment; it does not modify vehicle or owner records.
CREATE OR REPLACE FUNCTION public.get_available_vehicles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $available$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_user_id
      AND au.is_active = true
      AND r.name IN ('ADMIN', 'HEAD_OFFICE', 'BRANCH')
  ) THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'vehicle_id', v.vehicle_id,
        'plate_number', v.plate_number,
        'vehicle_code', v.vehicle_code,
        'owner_id', v.owner_id,
        'owner_name', vo.name
      )
      ORDER BY v.plate_number
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.vehicles v
  LEFT JOIN public.vehicle_owners vo
    ON vo.owner_id = v.owner_id
  WHERE v.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.vehicle_driver_assignments vda
      WHERE vda.vehicle_id = v.vehicle_id
        AND vda.assigned_to IS NULL
        AND vda.assigned_from <= now()
    );

  RETURN v_result;
END;
$available$;

REVOKE ALL ON FUNCTION public.get_available_vehicles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_vehicles() TO authenticated;
NOTIFY pgrst, 'reload schema';
