-- Harden SECURITY DEFINER routines against search_path object shadowing.
-- This migration is applied to the Tiba Supplies Shadow project only.
ALTER FUNCTION public.get_vehicle_live_locations()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.get_vehicle_owner_directory()
  SET search_path = pg_catalog, public;

NOTIFY pgrst, 'reload schema';
