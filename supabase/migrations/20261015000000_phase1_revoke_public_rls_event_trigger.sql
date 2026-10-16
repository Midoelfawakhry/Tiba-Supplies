-- Phase 1 security hardening: prevent API roles from invoking the SECURITY DEFINER event-trigger function directly.
-- Event triggers execute as their owner; direct EXECUTE grants are not required for DDL event-trigger dispatch.
-- A clean baseline may not include this legacy helper, so make the ACL hardening safe to replay.
DO $migration$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated';
  END IF;
END;
$migration$;
