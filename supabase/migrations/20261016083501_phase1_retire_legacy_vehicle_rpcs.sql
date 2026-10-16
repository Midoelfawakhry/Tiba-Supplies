-- Retire unused legacy RPCs whose single-driver/office semantics conflict with the current Phase 1 API.
-- The Shadow UI now uses main_office_* RPCs and branch_get_snapshot; no current app source calls these functions.
DO $retire$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.get_available_vehicles()',
    'public.create_operational_driver(text,text,uuid,text)',
    'public.create_operational_vehicle(text,text,text)'
  ]
  LOOP
    IF to_regprocedure(v_signature) IS NOT NULL THEN
      EXECUTE 'REVOKE ALL ON FUNCTION ' || v_signature || ' FROM PUBLIC, anon, authenticated';
    END IF;
  END LOOP;
  NOTIFY pgrst, 'reload schema';
END
$retire$;
