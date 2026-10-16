-- Definition-level regression checks for phase1_rpc_office_scope_hardening.
-- Run in the isolated v191 shadow project after applying the migration there.
-- This test does not create or mutate operational records.

DO $rpc_scope_checks$
DECLARE
  v_reports text;
  v_statements text;
  v_waiting text;
BEGIN
  SELECT upper(pg_get_functiondef('public.get_vehicle_owner_reports(date,date)'::regprocedure))
    INTO v_reports;
  SELECT upper(pg_get_functiondef('public.get_account_statement_records(date,date)'::regprocedure))
    INTO v_statements;
  SELECT upper(pg_get_functiondef('public.get_office_waiting_list()'::regprocedure))
    INTO v_waiting;

  IF position('PUBLIC.CURRENT_MAIN_OFFICE_USER()' IN v_reports) = 0 THEN
    RAISE EXCEPTION 'OWNER_REPORTS_MUST_REQUIRE_MAIN_OFFICE_HELPER';
  END IF;

  IF position('PUBLIC.CURRENT_MAIN_OFFICE_USER()' IN v_statements) = 0 THEN
    RAISE EXCEPTION 'ACCOUNT_STATEMENTS_MUST_REQUIRE_MAIN_OFFICE_HELPER';
  END IF;

  IF position('PUBLIC.CURRENT_RAS_SEDR_BRANCH_USER()' IN v_waiting) = 0
     OR position('PUBLIC.CURRENT_MAIN_OFFICE_USER()' IN v_waiting) = 0 THEN
    RAISE EXCEPTION 'WAITING_LIST_MUST_VALIDATE_BRANCH_OR_MAIN_OFFICE';
  END IF;

  IF has_function_privilege('anon', 'public.get_vehicle_owner_reports(date,date)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_account_statement_records(date,date)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_office_waiting_list()', 'EXECUTE') THEN
    RAISE EXCEPTION 'SCOPED_RPC_MUST_NOT_BE_EXECUTABLE_BY_ANON';
  END IF;
END
$rpc_scope_checks$;
