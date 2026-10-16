-- Shadow Phase 1 cleanup: remove the obsolete branch snapshot RPC.
-- Current branch UI uses public.branch_get_snapshot(); no database objects
-- depend on this legacy function. Do not use CASCADE so unexpected dependencies
-- stop the migration instead of being silently removed.
DROP FUNCTION IF EXISTS public.get_branch_office_snapshot();
