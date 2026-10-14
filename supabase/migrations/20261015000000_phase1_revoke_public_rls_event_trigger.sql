-- Phase 1 security hardening: prevent API roles from invoking the SECURITY DEFINER event-trigger function directly.
-- Event triggers execute as their owner; direct EXECUTE grants are not required for DDL event-trigger dispatch.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
