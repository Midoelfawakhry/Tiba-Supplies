-- Isolated regression test for RLS and grants on internal sequence counters.
-- The transaction is rolled back and contains only disposable fixtures.
\set ON_ERROR_STOP on
BEGIN;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'CREATE ROLE anon NOLOGIN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'CREATE ROLE authenticated NOLOGIN'; END IF;
END
$roles$;

CREATE TABLE public.daily_loading_counters (
  loading_date date PRIMARY KEY,
  last_number bigint NOT NULL CHECK (last_number >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.daily_trip_counters (
  assignment_date date PRIMARY KEY,
  last_number bigint NOT NULL CHECK (last_number >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Simulate accidental direct grants so the migration proves it revokes them.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_loading_counters TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_trip_counters TO anon, authenticated;

\ir ../migrations/20261012180000_enable_counter_rls.sql

DO $assertions$
DECLARE
  v_table text;
  v_rls boolean;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['daily_loading_counters','daily_trip_counters'] LOOP
    SELECT c.relrowsecurity INTO v_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=v_table;
    IF v_rls IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'COUNTER_RLS_NOT_ENABLED: %', v_table;
    END IF;

    IF has_table_privilege('anon', 'public.' || v_table, 'SELECT')
       OR has_table_privilege('anon', 'public.' || v_table, 'INSERT')
       OR has_table_privilege('authenticated', 'public.' || v_table, 'SELECT')
       OR has_table_privilege('authenticated', 'public.' || v_table, 'INSERT')
       OR has_table_privilege('authenticated', 'public.' || v_table, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || v_table, 'DELETE') THEN
      RAISE EXCEPTION 'CLIENT_COUNTER_PRIVILEGE_REMAINS: %', v_table;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=v_table
    ) THEN
      RAISE EXCEPTION 'COUNTER_CLIENT_POLICY_MUST_NOT_EXIST: %', v_table;
    END IF;
  END LOOP;
END
$assertions$;

ROLLBACK;
