-- This function is an internal trigger target, not a client-facing RPC.
-- PostgreSQL checks EXECUTE privilege when CREATE TRIGGER is issued; trigger
-- execution does not require granting EXECUTE to application roles.
REVOKE ALL ON FUNCTION public.auto_assign_driver_to_ras_sedr() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
