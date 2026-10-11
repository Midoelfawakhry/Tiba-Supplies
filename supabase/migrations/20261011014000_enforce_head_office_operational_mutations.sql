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


-- Direct assignments have no load_order_id. If one is cancelled before loading,
-- return the driver to the BRANCH queue without dereferencing a missing load order.
DO $cancel_fix$
DECLARE
  v_proc record;
  v_definition text;
  v_updated text;
BEGIN
  FOR v_proc IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'office_cancel_booking'
      AND pg_get_function_identity_arguments(p.oid) = 'p_booking_id uuid, p_reason text, p_vehicle_out_of_service boolean'
  LOOP
    v_definition := pg_get_functiondef(v_proc.oid);
    v_updated := replace(v_definition,
      E'  v_active_count integer;',
      E'  v_active_count integer;\n  v_checkin_office_id uuid;');
    v_updated := replace(v_updated,
      E'  SELECT * INTO v_order FROM public.load_orders WHERE load_order_id=v_booking.load_order_id FOR UPDATE;',
      E'  IF v_booking.load_order_id IS NULL THEN\n    SELECT office_id INTO v_checkin_office_id FROM public.offices WHERE is_active=true AND office_type=''BRANCH'' ORDER BY name LIMIT 1;\n    IF v_checkin_office_id IS NULL THEN RAISE EXCEPTION ''CHECK_IN_OFFICE_NOT_CONFIGURED''; END IF;\n  ELSE\n    SELECT * INTO v_order FROM public.load_orders WHERE load_order_id=v_booking.load_order_id FOR UPDATE;\n    v_checkin_office_id := v_order.check_in_office_id;\n  END IF;');
    v_updated := replace(v_updated,
      E'VALUES(v_booking.driver_id,v_booking.vehicle_id,v_order.check_in_office_id,now(),''WAITING'');',
      E'VALUES(v_booking.driver_id,v_booking.vehicle_id,v_checkin_office_id,now(),''WAITING'');');
    IF v_updated = v_definition OR position('v_checkin_office_id' in v_updated) = 0 THEN
      RAISE EXCEPTION 'DIRECT_CANCEL_PATCH_FAILED: expected office_cancel_booking source did not match';
    END IF;
    EXECUTE v_updated;
  END LOOP;
END;
$cancel_fix$;

NOTIFY pgrst, 'reload schema';
