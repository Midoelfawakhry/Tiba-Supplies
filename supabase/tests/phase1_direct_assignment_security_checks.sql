-- Retired legacy Phase 1 assertions.
-- The old body asserted a superseded lifecycle (direct_assign_standalone_load,
-- get_pending_direct_assignments, and creating actual_loading_records on driver
-- acceptance). The current workflow is:
--   main_office_create_direct_trip -> accept_direct_assignment
--   -> main_office_advance_booking(LOADING) -> main_office_advance_booking(LOADED)
-- Current definition-level lifecycle checks live in:
--   supabase/tests/phase1_current_lifecycle_checks.sql
-- Do not restore the legacy assertions; Git history retains the prior version.

-- Keep only the standalone regex behavior smoke checks that remain valid.
DO $regex_checks$
BEGIN
  IF NOT ('IF R.NAME IN (''ADMIN'', ''HEAD_OFFICE'', ''BRANCH'') THEN NULL; END IF;'
      ~* $$R\.NAME\s+IN\s*\([^)]*'BRANCH'$$) THEN
    RAISE EXCEPTION 'REGEX_MUST_MATCH_BRANCH_ROLE_GATE';
  END IF;

  IF NOT ('AND R.NAME = ''BRANCH''' ~* $$R\.NAME\s*=\s*'BRANCH'$$) THEN
    RAISE EXCEPTION 'REGEX_MUST_MATCH_BRANCH_ROLE_EQUALITY';
  END IF;

  IF ('-- BRANCH is only a geofence reference; no role predicate here'
      ~* $$R\.NAME\s+IN\s*\([^)]*'BRANCH'$$) THEN
    RAISE EXCEPTION 'REGEX_MUST_IGNORE_GEOFENCE_COMMENT';
  END IF;
END
$regex_checks$;
