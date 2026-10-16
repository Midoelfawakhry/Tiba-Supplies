-- Harden SECURITY DEFINER routines against search_path object shadowing.
-- Apply each hardening clause only when the legacy RPC exists in this baseline.
-- This keeps the migration replayable against clean v191 and older Shadow schemas.
DO $migration$
BEGIN
  IF to_regprocedure('public.get_vehicle_live_locations()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_vehicle_live_locations() SET search_path = pg_catalog, public';
  END IF;

  IF to_regprocedure('public.get_vehicle_owner_directory()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_vehicle_owner_directory() SET search_path = pg_catalog, public';
  END IF;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
