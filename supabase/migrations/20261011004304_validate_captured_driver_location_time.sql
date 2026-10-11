-- Reject stale/future device-captured GPS points even when uploaded just now.
DO $migration$
DECLARE
  v_signature text;
  v_definition text;
  v_updated text;
  v_old text;
  v_new text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.get_driver_geofence_status(uuid)',
    'public.direct_assign_standalone_load(uuid,uuid,uuid)'
  ]
  LOOP
    SELECT pg_get_functiondef(v_signature::regprocedure) INTO v_definition;
    v_updated := replace(
      v_definition,
      'v_location.updated_at < now() - interval ''10 minutes''',
      '(v_location.updated_at < now() - interval ''10 minutes'' OR v_location.captured_at < now() - interval ''10 minutes'' OR v_location.captured_at > now() + interval ''1 minute'')'
    );
    v_updated := replace(
      v_updated,
      'v_loc.updated_at < now() - interval ''10 minutes''',
      '(v_loc.updated_at < now() - interval ''10 minutes'' OR v_loc.captured_at < now() - interval ''10 minutes'' OR v_loc.captured_at > now() + interval ''1 minute'')'
    );
    IF v_updated = v_definition THEN
      RAISE EXCEPTION 'EXPECTED_GEOFENCE_FRESHNESS_CHECK_NOT_FOUND in %', v_signature;
    END IF;
    EXECUTE v_updated;
  END LOOP;

  SELECT pg_get_functiondef('public.update_driver_live_location(double precision,double precision,double precision,double precision,double precision,timestamp with time zone)'::regprocedure)
    INTO v_definition;
  v_old := '  INSERT INTO public.driver_live_locations (';
  v_new := '  IF p_captured_at IS NOT NULL AND (p_captured_at < now() - interval ''10 minutes'' OR p_captured_at > now() + interval ''1 minute'') THEN RAISE EXCEPTION ''LOCATION_CAPTURE_TIME_INVALID_OR_STALE''; END IF;' || E'\n' || v_old;
  v_updated := replace(v_definition, v_old, v_new);
  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'EXPECTED_LOCATION_UPSERT_NOT_FOUND';
  END IF;
  EXECUTE v_updated;
END;
$migration$;
NOTIFY pgrst, 'reload schema';
