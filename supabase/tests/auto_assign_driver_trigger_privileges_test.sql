-- Disposable PostgreSQL regression test: internal trigger remains functional
-- after client EXECUTE privileges are revoked. Never run this fixture on production.
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

CREATE TABLE public.offices (
  office_id uuid PRIMARY KEY,
  name text NOT NULL,
  office_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.drivers (
  driver_id uuid PRIMARY KEY,
  auth_user_id uuid,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.driver_office_assignments (
  assignment_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  driver_id uuid NOT NULL,
  office_id uuid NOT NULL,
  assigned_from timestamptz NOT NULL DEFAULT now(),
  assigned_to timestamptz
);

CREATE OR REPLACE FUNCTION public.auto_assign_driver_to_ras_sedr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_office_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.auth_user_id IS NULL OR OLD.auth_user_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.is_active IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  SELECT o.office_id INTO v_office_id
  FROM public.offices o
  WHERE o.name = 'مكتب طيبة للتوريدات - رأس سدر'
    AND o.office_type = 'BRANCH'
    AND o.is_active = true
  ORDER BY o.created_at NULLS LAST, o.office_id
  LIMIT 1;

  IF v_office_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_RAS_SEDR_OFFICE_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.driver_office_assignments doa
    WHERE doa.driver_id = NEW.driver_id AND doa.assigned_to IS NULL
  ) THEN
    INSERT INTO public.driver_office_assignments
      (driver_id, office_id, assigned_from, assigned_to)
    VALUES (NEW.driver_id, v_office_id, now(), NULL);
  END IF;
  RETURN NEW;
END;
$function$;

-- Install the trigger while running as the owner, then apply the candidate migration.
CREATE TRIGGER trg_auto_assign_driver_ras_sedr_insert
AFTER INSERT ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_driver_to_ras_sedr();

CREATE TRIGGER trg_auto_assign_driver_ras_sedr_auth_link
AFTER UPDATE OF auth_user_id ON public.drivers
FOR EACH ROW
WHEN (OLD.auth_user_id IS NULL AND NEW.auth_user_id IS NOT NULL)
EXECUTE FUNCTION public.auto_assign_driver_to_ras_sedr();

\ir ../migrations/20261012190000_restrict_auto_assign_driver_rpc.sql

INSERT INTO public.offices(office_id, name, office_type, is_active)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'مكتب طيبة للتوريدات - رأس سدر', 'BRANCH', true);

DO $assertions$
DECLARE
  v_inserted_driver uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_linked_driver uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_office uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_count integer;
BEGIN
  IF has_function_privilege('anon', 'public.auto_assign_driver_to_ras_sedr()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.auto_assign_driver_to_ras_sedr()', 'EXECUTE') THEN
    RAISE EXCEPTION 'TEST_FAILED_CLIENT_CAN_EXECUTE_TRIGGER_FUNCTION';
  END IF;

  -- Creating an active driver must still invoke the trigger and assign the branch.
  INSERT INTO public.drivers(driver_id, is_active)
  VALUES (v_inserted_driver, true);

  SELECT count(*) INTO v_count FROM public.driver_office_assignments
  WHERE driver_id = v_inserted_driver AND office_id = v_office AND assigned_to IS NULL;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST_FAILED_INSERT_TRIGGER_ASSIGNMENT: %', v_count;
  END IF;

  -- Linking an auth account to an existing driver must also invoke the trigger.
  INSERT INTO public.drivers(driver_id, auth_user_id, is_active)
  VALUES (v_linked_driver, NULL, true);
  UPDATE public.drivers
  SET auth_user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  WHERE driver_id = v_linked_driver;

  SELECT count(*) INTO v_count FROM public.driver_office_assignments
  WHERE driver_id = v_linked_driver AND office_id = v_office AND assigned_to IS NULL;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST_FAILED_AUTH_LINK_TRIGGER_ASSIGNMENT: %', v_count;
  END IF;
END
$assertions$;

ROLLBACK;
