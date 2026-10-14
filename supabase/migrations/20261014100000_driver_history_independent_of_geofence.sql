-- Keep the driver's trip history visible from anywhere.
-- The 10 km geofence applies to local loads, check-in and queue operations,
-- not to reading the authenticated driver's own bookings.
DO $migration$
DECLARE
  v_definition text;
  v_marker text := '''my_bookings'', CASE WHEN v_inside THEN COALESCE((';
  v_prefix text;
  v_tail text;
  v_pos integer;
BEGIN
  SELECT pg_get_functiondef('public.get_driver_portal_snapshot()'::regprocedure)
    INTO v_definition;

  v_pos := position(v_marker IN v_definition);
  IF v_pos = 0 THEN
    RAISE EXCEPTION 'Expected my_bookings geofence wrapper was not found';
  END IF;

  v_prefix := left(v_definition, v_pos - 1);
  v_tail := substring(v_definition FROM v_pos);

  v_tail := replace(
    v_tail,
    v_marker,
    '''my_bookings'', COALESCE(('
  );

  v_tail := replace(
    v_tail,
    '), ''[]''::jsonb) ELSE ''[]''::jsonb END',
    '), ''[]''::jsonb)'
  );

  IF v_tail LIKE '%' || v_marker || '%' OR
     v_tail NOT LIKE '%''my_bookings'', COALESCE((%' THEN
    RAISE EXCEPTION 'Failed to remove geofence wrapper from driver history';
  END IF;

  EXECUTE v_prefix || v_tail;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
