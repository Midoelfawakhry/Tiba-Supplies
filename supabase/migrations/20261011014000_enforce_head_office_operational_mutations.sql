-- Enforce the office responsibility boundary across operational mutation RPCs.
-- HEAD/ADMIN may mutate operations. BRANCH remains the location/geofence office.
-- This migration rewrites the role gate in the existing function definitions so the
-- complete business logic is preserved rather than copied into a second implementation.
DO $migration$
DECLARE
  v_proc record;
  v_definition text;
  v_updated text;
  v_changed boolean;
BEGIN
  FOR v_proc IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname = ANY (ARRAY[
        'create_operational_driver',
        'create_operational_vehicle',
        'update_operational_driver',
        'update_operational_vehicle',
        'dispatch_load',
        'office_cancel_booking',
        'office_redirect_booking'
      ])
  LOOP
    v_definition := pg_get_functiondef(v_proc.oid);
    v_updated := replace(v_definition, 'r.name IN (''ADMIN'', ''HEAD_OFFICE'', ''BRANCH'')',
                                         'r.name IN (''ADMIN'', ''HEAD_OFFICE'')');
    v_updated := replace(v_updated, 'r.name IN (''ADMIN'',''HEAD_OFFICE'',''BRANCH'')',
                                       'r.name IN (''ADMIN'',''HEAD_OFFICE'')');
    v_updated := replace(v_updated, 'r.name IN (''ADMIN'', ''HEAD_OFFICE'', ''BRANCH'' )',
                                         'r.name IN (''ADMIN'', ''HEAD_OFFICE'' )');
    IF v_updated <> v_definition THEN
      EXECUTE v_updated;
      RAISE NOTICE 'Restricted BRANCH operational mutation permission in %', v_proc.proname;
    ELSE
      RAISE NOTICE 'No matching role gate changed in %; manual review required', v_proc.proname;
    END IF;
  END LOOP;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
