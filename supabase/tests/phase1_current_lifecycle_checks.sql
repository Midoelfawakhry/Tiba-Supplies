-- Current Phase 1 lifecycle checks for an isolated database after the intended
-- current schema/migrations are installed. This is definition-level validation:
-- it does not create business rows or prove runtime concurrency/auth behavior.
-- Do not run against Production as a substitute for release acceptance.

DO $checks$
DECLARE
  v_def text;
  v_sig text;
BEGIN
  -- Current RPC surface; legacy standalone-assignment RPCs are not the current path.
  FOREACH v_sig IN ARRAY ARRAY[
    'public.main_office_create_direct_trip(uuid,uuid,uuid)',
    'public.driver_get_pending_assignments()',
    'public.accept_direct_assignment(uuid)',
    'public.main_office_advance_booking(uuid,text,numeric,text,text)'
  ] LOOP
    IF to_regprocedure(v_sig) IS NULL THEN
      RAISE EXCEPTION 'CURRENT_LIFECYCLE_RPC_MISSING: %', v_sig;
    END IF;
  END LOOP;

  -- Creating a direct trip creates an offer/booking, not actual loading evidence.
  SELECT pg_get_functiondef(to_regprocedure(
    'public.main_office_create_direct_trip(uuid,uuid,uuid)'
  )) INTO v_def;
  IF position('''DIRECT'',''ASSIGNED'',V_TRIP_CODE,''PENDING''' in upper(v_def)) = 0
     OR position('ACCEPTANCE_REQUIRED' in upper(v_def)) = 0
     OR position('INSERT INTO PUBLIC.ACTUAL_LOADING_RECORDS' in upper(v_def)) > 0
     OR position('WRITE_AUDIT_EVENT' in upper(v_def)) = 0 THEN
    RAISE EXCEPTION 'DIRECT_TRIP_MUST_CREATE_PENDING_AUDITED_OFFER_ONLY';
  END IF;

  -- Driver acceptance is ownership-checked and only changes acceptance/audit state.
  SELECT pg_get_functiondef(to_regprocedure(
    'public.accept_direct_assignment(uuid)'
  )) INTO v_def;
  IF position('AUTH.UID()' in upper(v_def)) = 0
     OR position('FOR UPDATE' in upper(v_def)) = 0
     OR position('BOOKING_NOT_YOURS' in upper(v_def)) = 0
     OR position('DIRECT_ACCEPTANCE_STATUS=''ACCEPTED''' in upper(v_def)) = 0
     OR position('INSERT INTO PUBLIC.ACTUAL_LOADING_RECORDS' in upper(v_def)) > 0
     OR position('WRITE_AUDIT_EVENT' in upper(v_def)) = 0 THEN
    RAISE EXCEPTION 'DIRECT_ACCEPTANCE_MUST_CHECK_OWNER_WITHOUT_RECORDING_LOADING';
  END IF;

  -- Loading evidence is created only when the office transitions LOADING -> LOADED.
  SELECT pg_get_functiondef(to_regprocedure(
    'public.main_office_advance_booking(uuid,text,numeric,text,text)'
  )) INTO v_def;
  IF position('V_NEXT=''LOADED''' in upper(v_def)) = 0
     OR position('V_BOOKING.STATUS<>''LOADING''' in upper(v_def)) = 0
     OR position('POSITIVE_ACTUAL_WEIGHT_REQUIRED' in upper(v_def)) = 0
     OR position('INSERT INTO PUBLIC.ACTUAL_LOADING_RECORDS(BOOKING_ID,ACTUAL_WEIGHT' in upper(v_def)) = 0
     OR position('DRIVER_ACCEPTANCE_REQUIRED' in upper(v_def)) = 0 THEN
    RAISE EXCEPTION 'ACTUAL_LOADING_MUST_REQUIRE_ACCEPTANCE_LOADING_STATE_AND_POSITIVE_WEIGHT';
  END IF;

  -- Database constraints prevent multiple actual rows for one booking and non-positive weights.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='actual_loading_records'
      AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ILIKE '%(booking_id)%'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='actual_loading_records'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%ON public.actual_loading_records USING btree (booking_id)%'
  ) THEN
    RAISE EXCEPTION 'ACTUAL_LOADING_BOOKING_MUST_BE_UNIQUE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='actual_loading_records'
      AND c.contype='c'
      AND pg_get_constraintdef(c.oid) ILIKE '%actual_weight > 0%'
  ) THEN
    RAISE EXCEPTION 'ACTUAL_LOADING_WEIGHT_MUST_BE_POSITIVE';
  END IF;
END
$checks$;

-- Diagnostic only: show the current lifecycle RPC's effective execution grants.
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN (
    'main_office_create_direct_trip',
    'driver_get_pending_assignments',
    'accept_direct_assignment',
    'main_office_advance_booking'
  )
ORDER BY p.proname, arguments;
