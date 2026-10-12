-- Isolated PostgreSQL integration test for the candidate master-directory migration.
-- This creates only disposable mock schema/roles in the CI PostgreSQL service.
-- The transaction is rolled back at the end; never run as a production migration.
\set ON_ERROR_STOP on
BEGIN;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'CREATE ROLE anon NOLOGIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'CREATE ROLE authenticated NOLOGIN';
  END IF;
END
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $uid$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$uid$;

CREATE TABLE public.app_users (
  user_id uuid PRIMARY KEY,
  auth_user_id uuid,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.roles (
  role_id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE
);
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  PRIMARY KEY (user_id, role_id)
);
CREATE TABLE public.factories (
  factory_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text UNIQUE,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.quarries (
  quarry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text UNIQUE,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.audit_log (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.auto_assign_driver_to_ras_sedr()
RETURNS trigger
LANGUAGE plpgsql
AS $trigger$
BEGIN
  RETURN NEW;
END;
$trigger$;

\ir ../migrations/20261012160000_head_office_master_directory_write.sql

INSERT INTO public.roles(role_id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'HEAD_OFFICE'),
  ('00000000-0000-0000-0000-000000000002', 'BRANCH');
INSERT INTO public.app_users(user_id, auth_user_id, is_active) VALUES
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', true),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', false);
INSERT INTO public.user_roles(user_id, role_id) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001');

DO $tests$
DECLARE
  v_result jsonb;
  v_factory_id uuid;
  v_audit_count integer;
BEGIN
  -- No authenticated identity must fail closed.
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    PERFORM public.save_master_directory_entry('factory', NULL, 'Unauthenticated', 'NOAUTH');
    RAISE EXCEPTION 'TEST_FAILED_EXPECTED_AUTH_REQUIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'AUTH_REQUIRED' THEN RAISE; END IF;
  END;

  -- Authenticated but non-head-office user must be rejected.
  PERFORM set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
  BEGIN
    PERFORM public.save_master_directory_entry('factory', NULL, 'Branch Attempt', 'BR-01');
    RAISE EXCEPTION 'TEST_FAILED_EXPECTED_INSUFFICIENT_ROLE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'INSUFFICIENT_ROLE' THEN RAISE; END IF;
  END;

  -- Inactive head-office profile must be rejected even if it has the role.
  PERFORM set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000003', true);
  BEGIN
    PERFORM public.save_master_directory_entry('factory', NULL, 'Inactive Attempt', 'INACTIVE');
    RAISE EXCEPTION 'TEST_FAILED_EXPECTED_INSUFFICIENT_ROLE_FOR_INACTIVE_USER';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'INSUFFICIENT_ROLE' THEN RAISE; END IF;
  END;

  -- Active head-office user can create and audit a factory.
  PERFORM set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
  v_result := public.save_master_directory_entry(
    'factory', NULL, 'Test Factory', ' fx-01 ', 'Ismailia', '01000000000', true
  );
  IF COALESCE((v_result->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST_FAILED_FACTORY_CREATE';
  END IF;
  v_factory_id := (v_result->>'entity_id')::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM public.factories
    WHERE factory_id = v_factory_id AND code = 'FX-01'
      AND address = 'Ismailia' AND phone = '01000000000' AND is_active
  ) THEN RAISE EXCEPTION 'TEST_FAILED_FACTORY_NORMALIZATION_OR_PERSISTENCE'; END IF;

  -- Codes are normalized and duplicate checks must be case/space insensitive.
  BEGIN
    PERFORM public.save_master_directory_entry('factory', NULL, 'Second Factory', ' fx-01 ');
    RAISE EXCEPTION 'TEST_FAILED_EXPECTED_DUPLICATE_CODE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'DIRECTORY_CODE_EXISTS' THEN RAISE; END IF;
  END;

  -- Exact duplicate names must fail with a stable application error.
  BEGIN
    PERFORM public.save_master_directory_entry('factory', NULL, 'Test Factory', 'FX-02');
    RAISE EXCEPTION 'TEST_FAILED_EXPECTED_DUPLICATE_NAME';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'DIRECTORY_NAME_EXISTS' THEN RAISE; END IF;
  END;

  -- Name uniqueness is normalized for case and surrounding whitespace too.
  BEGIN
    PERFORM public.save_master_directory_entry('factory', NULL, '  test factory  ', 'FX-03');
    RAISE EXCEPTION 'TEST_FAILED_EXPECTED_NORMALIZED_DUPLICATE_NAME';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'DIRECTORY_NAME_EXISTS' THEN RAISE; END IF;
  END;

  -- Updating the same row may retain its current name/code; old and new data are audited.
  v_result := public.save_master_directory_entry(
    'factory', v_factory_id, 'Test Factory', 'fx-01', 'Updated address', NULL, false
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.factories
    WHERE factory_id = v_factory_id AND address = 'Updated address'
      AND phone IS NULL AND is_active = false
  ) THEN RAISE EXCEPTION 'TEST_FAILED_FACTORY_UPDATE'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE entity_type = 'factory' AND entity_id = v_factory_id::text
      AND action = 'MASTER_DIRECTORY_ENTRY_CREATED'
      AND new_data->>'code' = 'FX-01'
  ) THEN RAISE EXCEPTION 'TEST_FAILED_CREATE_AUDIT'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE entity_type = 'factory' AND entity_id = v_factory_id::text
      AND action = 'MASTER_DIRECTORY_ENTRY_UPDATED'
      AND old_data->>'address' = 'Ismailia'
      AND new_data->>'address' = 'Updated address'
      AND new_data->>'is_active' = 'false'
  ) THEN RAISE EXCEPTION 'TEST_FAILED_UPDATE_AUDIT'; END IF;

  -- Quarry is a separate namespace; a code used by a factory can be reused there.
  v_result := public.save_master_directory_entry('quarry', NULL, 'Test Quarry', 'FX-01');
  IF COALESCE((v_result->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST_FAILED_QUARRY_CREATE';
  END IF;

  -- RPC is callable by authenticated users only; trigger-only function is not an RPC.
  IF has_function_privilege('anon',
      'public.save_master_directory_entry(text,uuid,text,text,text,text,boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'TEST_FAILED_ANON_CAN_EXECUTE_DIRECTORY_RPC';
  END IF;
  IF NOT has_function_privilege('authenticated',
      'public.save_master_directory_entry(text,uuid,text,text,text,text,boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'TEST_FAILED_AUTHENTICATED_CANNOT_EXECUTE_DIRECTORY_RPC';
  END IF;
  IF has_function_privilege('anon', 'public.auto_assign_driver_to_ras_sedr()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.auto_assign_driver_to_ras_sedr()', 'EXECUTE') THEN
    RAISE EXCEPTION 'TEST_FAILED_TRIGGER_FUNCTION_EXPOSED_AS_RPC';
  END IF;

  SELECT count(*) INTO v_audit_count FROM public.audit_log;
  IF v_audit_count <> 3 THEN
    RAISE EXCEPTION 'TEST_FAILED_AUDIT_ROW_COUNT: %', v_audit_count;
  END IF;
END
$tests$;

ROLLBACK;
