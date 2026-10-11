-- CI-only regression test against a disposable PostgreSQL service.
-- NEVER run this fixture script against Supabase production.
\set ON_ERROR_STOP on

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'CREATE ROLE anon'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'CREATE ROLE authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN EXECUTE 'CREATE ROLE service_role'; END IF;
END
$roles$;

DROP TABLE IF EXISTS public.phase1_privilege_existing_test;
DROP TABLE IF EXISTS public.phase1_privilege_future_test;

CREATE TABLE public.phase1_privilege_existing_test (id integer PRIMARY KEY);
GRANT TRUNCATE, REFERENCES, TRIGGER ON TABLE public.phase1_privilege_existing_test TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT TRUNCATE, REFERENCES, TRIGGER ON TABLES TO anon, authenticated, service_role;

DO $setup_maintain$
BEGIN
  IF current_setting('server_version_num')::integer >= 170000 THEN
    EXECUTE 'GRANT MAINTAIN ON TABLE public.phase1_privilege_existing_test TO anon, authenticated, service_role';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT MAINTAIN ON TABLES TO anon, authenticated, service_role';
  END IF;
END
$setup_maintain$;

\i supabase/migrations/20261011133300_revoke_unused_client_table_privileges.sql

CREATE TABLE public.phase1_privilege_future_test (id integer PRIMARY KEY);

DO $assertions$
DECLARE
  v_privilege text;
  v_has_privilege boolean;
BEGIN
  FOREACH v_privilege IN ARRAY ARRAY['TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
    IF has_table_privilege('anon', 'public.phase1_privilege_existing_test', v_privilege)
       OR has_table_privilege('authenticated', 'public.phase1_privilege_existing_test', v_privilege)
       OR has_table_privilege('anon', 'public.phase1_privilege_future_test', v_privilege)
       OR has_table_privilege('authenticated', 'public.phase1_privilege_future_test', v_privilege) THEN
      RAISE EXCEPTION 'CLIENT_PRIVILEGE_NOT_REVOKED: %', v_privilege;
    END IF;
    IF NOT has_table_privilege('service_role', 'public.phase1_privilege_existing_test', v_privilege) THEN
      RAISE EXCEPTION 'SERVICE_ROLE_PRIVILEGE_CHANGED: %', v_privilege;
    END IF;
  END LOOP;

  IF has_table_privilege('anon', 'public.phase1_privilege_existing_test', 'SELECT')
     OR has_table_privilege('authenticated', 'public.phase1_privilege_existing_test', 'INSERT')
     OR has_table_privilege('anon', 'public.phase1_privilege_existing_test', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.phase1_privilege_existing_test', 'DELETE') THEN
    RAISE EXCEPTION 'UNEXPECTED_DML_PRIVILEGE_IN_TEST_FIXTURE';
  END IF;

  IF current_setting('server_version_num')::integer >= 170000 THEN
    EXECUTE 'SELECT has_table_privilege(''anon'', ''public.phase1_privilege_existing_test'', ''MAINTAIN'')' INTO v_has_privilege;
    IF v_has_privilege THEN RAISE EXCEPTION 'ANON_MAINTAIN_PRIVILEGE_NOT_REVOKED'; END IF;
    EXECUTE 'SELECT has_table_privilege(''authenticated'', ''public.phase1_privilege_existing_test'', ''MAINTAIN'')' INTO v_has_privilege;
    IF v_has_privilege THEN RAISE EXCEPTION 'AUTHENTICATED_MAINTAIN_PRIVILEGE_NOT_REVOKED'; END IF;
    EXECUTE 'SELECT has_table_privilege(''anon'', ''public.phase1_privilege_future_test'', ''MAINTAIN'')' INTO v_has_privilege;
    IF v_has_privilege THEN RAISE EXCEPTION 'ANON_DEFAULT_MAINTAIN_PRIVILEGE_NOT_REVOKED'; END IF;
    EXECUTE 'SELECT has_table_privilege(''authenticated'', ''public.phase1_privilege_future_test'', ''MAINTAIN'')' INTO v_has_privilege;
    IF v_has_privilege THEN RAISE EXCEPTION 'AUTHENTICATED_DEFAULT_MAINTAIN_PRIVILEGE_NOT_REVOKED'; END IF;
  END IF;
END
$assertions$;

DROP TABLE public.phase1_privilege_future_test;
DROP TABLE public.phase1_privilege_existing_test;
