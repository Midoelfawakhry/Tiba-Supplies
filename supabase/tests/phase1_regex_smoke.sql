-- PostgreSQL-only smoke test for the BRANCH role-gate detector.
-- This intentionally tests regex behavior without touching application tables.
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
