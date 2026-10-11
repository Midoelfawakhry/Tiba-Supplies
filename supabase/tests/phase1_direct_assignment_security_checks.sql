-- Static database-side regression checks for Phase 1 RPC definitions.
-- Run only in isolated staging AFTER all intended Phase 1 migrations.
-- This script does not create bookings, drivers, GPS points, or loading records.

DO $checks$
DECLARE
  v_name text;
  v_def text;
  v_sig text;
  v_required text[] := ARRAY[
    'public.direct_assign_standalone_load(uuid,uuid,uuid)',
    'public.get_pending_direct_assignments()',
    'public.accept_direct_assignment(uuid)',
    'public.get_driver_portal_snapshot()',
    'public.dispatch_load(uuid)',
    'public.office_cancel_booking(uuid,text,boolean)',
    'public.office_redirect_booking(uuid,uuid,text)'
  ];
  v_write_targets text[] := ARRAY[
    'create_operational_driver',
    'create_operational_vehicle',
    'update_operational_driver',
    'update_operational_vehicle',
    'dispatch_load',
    'office_cancel_booking',
    'office_redirect_booking'
  ];
  r record;
BEGIN
  FOREACH v_sig IN ARRAY v_required LOOP
    IF to_regprocedure(v_sig) IS NULL THEN
      RAISE EXCEPTION 'REQUIRED_PHASE1_RPC_MISSING: %', v_sig;
    END IF;
  END LOOP;

  -- Direct assignment must create a pending booking only; it must not write
  -- an actual loading record before driver acceptance.
  SELECT pg_get_functiondef(to_regprocedure(
    'public.direct_assign_standalone_load(uuid,uuid,uuid)'
  )) INTO v_def;
  IF position('''BOOKED''' in v_def) = 0
     OR position('''LOADING_STATEMENT''' in v_def) > 0
     OR position('INSERT INTO public.actual_loading_records' in upper(v_def)) > 0 THEN
    RAISE EXCEPTION 'DIRECT_ASSIGNMENT_MUST_REMAIN_PENDING_UNTIL_ACCEPTED';
  END IF;

  -- Acceptance must lock the booking, enforce driver ownership, and create
  -- the one actual record in the same transaction.
  SELECT pg_get_functiondef(to_regprocedure(
    'public.accept_direct_assignment(uuid)'
  )) INTO v_def;
  IF position('FOR UPDATE' in upper(v_def)) = 0
     OR position('DIRECT_ASSIGNMENT_NOT_YOURS' in v_def) = 0
     OR position('INSERT INTO PUBLIC.ACTUAL_LOADING_RECORDS' in upper(v_def)) = 0
     OR position('ACCEPTED_AT' in upper(v_def)) = 0 THEN
    RAISE EXCEPTION 'DIRECT_ACCEPTANCE_GUARDS_MISSING';
  END IF;

  -- BRANCH must not be an authorized role in any operational write RPC.
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
           pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname = ANY(v_write_targets)
  LOOP
    IF position('BRANCH' in upper(r.def)) > 0
       AND position('r.name IN (''ADMIN'', ''HEAD_OFFICE'', ''BRANCH'')' in r.def) > 0
       OR position('r.name IN (''ADMIN'',''HEAD_OFFICE'',''BRANCH'')' in r.def) > 0 THEN
      RAISE EXCEPTION 'BRANCH_ROLE_STILL_PRESENT_IN_WRITE_RPC: %.%', r.proname, r.args;
    END IF;
  END LOOP;

  -- Critical SECURITY DEFINER entry points must pin search_path to public (or
  -- an equivalently reviewed fixed path) to reduce object-shadowing risk.
  FOREACH v_sig IN ARRAY ARRAY[
    'public.direct_assign_standalone_load(uuid,uuid,uuid)',
    'public.get_pending_direct_assignments()',
    'public.accept_direct_assignment(uuid)',
    'public.get_driver_portal_snapshot()',
    'public.dispatch_load(uuid)',
    'public.office_cancel_booking(uuid,text,boolean)',
    'public.office_redirect_booking(uuid,uuid,text)'
  ] LOOP
    SELECT pg_get_functiondef(to_regprocedure(v_sig)) INTO v_def;
    IF position('SECURITY DEFINER' in upper(v_def)) > 0
       AND position('SET search_path' in lower(v_def)) = 0 THEN
      RAISE EXCEPTION 'SECURITY_DEFINER_WITHOUT_FIXED_SEARCH_PATH: %', v_sig;
    END IF;
  END LOOP;
END
$checks$;

SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'direct_assign_standalone_load',
    'get_pending_direct_assignments',
    'accept_direct_assignment',
    'dispatch_load',
    'office_cancel_booking',
    'office_redirect_booking'
  )
ORDER BY p.proname, arguments;
