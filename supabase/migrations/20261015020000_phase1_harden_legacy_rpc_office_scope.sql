-- Phase 1 hardening: close legacy RPC privilege gaps on Shadow.
-- Driver/vehicle writes are limited to active MAIN office accounts. Retire unused
-- legacy vehicle-update and broad snapshot RPCs from API roles; current Shadow UI
-- uses main_office_* scoped RPCs instead.
DO $hardening$
DECLARE
  v_def text;
  v_new text;
  v_sig text;
BEGIN
  v_sig := 'public.create_operational_driver(text,text,uuid,text)';
  SELECT pg_get_functiondef(to_regprocedure(v_sig)) INTO v_def;
  IF v_def IS NULL THEN RAISE EXCEPTION 'EXPECTED_RPC_MISSING: %', v_sig; END IF;
  v_new := replace(v_def,
    'IF v_app_user_id IS NULL OR v_role NOT IN (''ADMIN'',''HEAD_OFFICE'',''BRANCH'') THEN RAISE EXCEPTION ''INSUFFICIENT_ROLE''; END IF;',
    'IF v_app_user_id IS NULL OR v_role NOT IN (''ADMIN'',''HEAD_OFFICE'') OR NOT EXISTS (SELECT 1 FROM public.offices o WHERE o.office_id=v_office_id AND o.office_code=''MAIN'' AND o.office_type=''HEAD_OFFICE'' AND o.is_active=true) THEN RAISE EXCEPTION ''INSUFFICIENT_ROLE''; END IF;');
  IF v_new = v_def THEN
    v_new := replace(v_def,
      'IF v_app_user_id IS NULL OR v_role NOT IN (''ADMIN'', ''HEAD_OFFICE'', ''BRANCH'') THEN RAISE EXCEPTION ''INSUFFICIENT_ROLE''; END IF;',
      'IF v_app_user_id IS NULL OR v_role NOT IN (''ADMIN'', ''HEAD_OFFICE'') OR NOT EXISTS (SELECT 1 FROM public.offices o WHERE o.office_id=v_office_id AND o.office_code=''MAIN'' AND o.office_type=''HEAD_OFFICE'' AND o.is_active=true) THEN RAISE EXCEPTION ''INSUFFICIENT_ROLE''; END IF;');
  END IF;
  IF v_new = v_def THEN RAISE EXCEPTION 'DRIVER_RPC_ROLE_GUARD_PATTERN_NOT_FOUND'; END IF;
  EXECUTE v_new;

  v_sig := 'public.create_operational_vehicle(text,text,text)';
  SELECT pg_get_functiondef(to_regprocedure(v_sig)) INTO v_def;
  IF v_def IS NOT NULL THEN
    v_new := replace(v_def,
      'IF v_app_user_id IS NULL OR v_role NOT IN (''ADMIN'',''HEAD_OFFICE'') THEN RAISE EXCEPTION ''INSUFFICIENT_ROLE''; END IF;',
      'IF v_app_user_id IS NULL OR v_role NOT IN (''ADMIN'',''HEAD_OFFICE'') OR NOT EXISTS (SELECT 1 FROM public.offices o WHERE o.office_id=v_office_id AND o.office_code=''MAIN'' AND o.office_type=''HEAD_OFFICE'' AND o.is_active=true) THEN RAISE EXCEPTION ''INSUFFICIENT_ROLE''; END IF;');
    IF v_new = v_def THEN
      v_new := replace(v_def,
        'IF v_app_user_id IS NULL OR v_role NOT IN (''ADMIN'', ''HEAD_OFFICE'') THEN RAISE EXCEPTION ''INSUFFICIENT_ROLE''; END IF;',
        'IF v_app_user_id IS NULL OR v_role NOT IN (''ADMIN'', ''HEAD_OFFICE'') OR NOT EXISTS (SELECT 1 FROM public.offices o WHERE o.office_id=v_office_id AND o.office_code=''MAIN'' AND o.office_type=''HEAD_OFFICE'' AND o.is_active=true) THEN RAISE EXCEPTION ''INSUFFICIENT_ROLE''; END IF;');
    END IF;
    IF v_new = v_def THEN RAISE EXCEPTION 'VEHICLE_CREATE_ROLE_GUARD_PATTERN_NOT_FOUND'; END IF;
    EXECUTE v_new;
  END IF;

  v_sig := 'public.update_operational_vehicle(uuid,text,text,uuid,text,text)';
  IF to_regprocedure(v_sig) IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || v_sig || ' FROM PUBLIC, anon, authenticated';
  END IF;
  v_sig := 'public.get_phase1_snapshot()';
  IF to_regprocedure(v_sig) IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || v_sig || ' FROM PUBLIC, anon, authenticated';
  END IF;
  NOTIFY pgrst, 'reload schema';
END
$hardening$;