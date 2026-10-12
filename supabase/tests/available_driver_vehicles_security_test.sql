-- Isolated PostgreSQL regression tests for get_available_driver_vehicles().
-- The transaction is rolled back; no production records are created.
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
RETURNS uuid LANGUAGE sql STABLE
AS $uid$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $uid$;

CREATE TABLE public.drivers (
  driver_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.vehicles (
  vehicle_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.vehicle_driver_assignments (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  assigned_to timestamptz
);

CREATE FUNCTION public.get_available_driver_vehicles()
RETURNS TABLE(vehicle_id uuid, plate_number text)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $base$ SELECT v.vehicle_id, v.plate_number FROM public.vehicles v WHERE v.is_active ORDER BY v.plate_number $base$;

\ir ../migrations/20261012170000_harden_available_driver_vehicles.sql

INSERT INTO public.drivers(driver_id, auth_user_id, is_active) VALUES
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',true),
  ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',false);
INSERT INTO public.vehicles(vehicle_id, plate_number, is_active) VALUES
  ('30000000-0000-0000-0000-000000000001','TEST-AVAILABLE',true),
  ('30000000-0000-0000-0000-000000000002','TEST-ASSIGNED',true),
  ('30000000-0000-0000-0000-000000000003','TEST-INACTIVE',false);
INSERT INTO public.vehicle_driver_assignments(vehicle_id, driver_id, assigned_to) VALUES
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',NULL);

DO $tests$
DECLARE
  v_count integer;
  v_plate text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    PERFORM * FROM public.get_available_driver_vehicles();
    RAISE EXCEPTION 'TEST_FAILED_EXPECTED_AUTH_REQUIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'AUTH_REQUIRED' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
  BEGIN
    PERFORM * FROM public.get_available_driver_vehicles();
    RAISE EXCEPTION 'TEST_FAILED_EXPECTED_DRIVER_ACCOUNT_NOT_LINKED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'DRIVER_ACCOUNT_NOT_LINKED' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
  SELECT count(*), min(plate_number) INTO v_count, v_plate
  FROM public.get_available_driver_vehicles();

  IF v_count <> 1 OR v_plate <> 'TEST-AVAILABLE' THEN
    RAISE EXCEPTION 'TEST_FAILED_AVAILABLE_VEHICLE_FILTER: count %, plate %', v_count, v_plate;
  END IF;

  IF has_function_privilege('anon', 'public.get_available_driver_vehicles()', 'EXECUTE') THEN
    RAISE EXCEPTION 'TEST_FAILED_ANON_CAN_EXECUTE_DRIVER_VEHICLE_PICKER';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_available_driver_vehicles()', 'EXECUTE') THEN
    RAISE EXCEPTION 'TEST_FAILED_AUTHENTICATED_CANNOT_EXECUTE_DRIVER_VEHICLE_PICKER';
  END IF;
END
$tests$;

ROLLBACK;
