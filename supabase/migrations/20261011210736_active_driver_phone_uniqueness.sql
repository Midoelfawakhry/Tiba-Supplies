-- Allow archived driver phone numbers to be reused by a new active driver record.
-- Historical driver rows remain intact; only active drivers must have unique phone/code values.

ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS drivers_phone_active_key
  ON public.drivers (phone)
  WHERE is_active = true AND phone IS NOT NULL;

DO $migration$
DECLARE
  v_create text;
  v_update text;
BEGIN
  v_create := pg_get_functiondef('public.create_operational_driver(text,text,uuid,text)'::regprocedure);
  v_create := replace(
    v_create,
    E'FROM public.drivers d\n    WHERE regexp_replace',
    E'FROM public.drivers d\n    WHERE d.is_active = true\n      AND regexp_replace'
  );
  v_create := replace(
    v_create,
    E'FROM public.drivers d\n    WHERE lower(btrim(d.driver_code)) = lower(v_code)',
    E'FROM public.drivers d\n    WHERE d.is_active = true\n      AND lower(btrim(d.driver_code)) = lower(v_code)'
  );

  v_update := pg_get_functiondef('public.update_operational_driver(uuid,text,text,text,uuid)'::regprocedure);
  v_update := replace(
    v_update,
    E'FROM public.drivers d\n    WHERE d.driver_id <> p_driver_id\n      AND regexp_replace',
    E'FROM public.drivers d\n    WHERE d.driver_id <> p_driver_id\n      AND d.is_active = true\n      AND regexp_replace'
  );
  v_update := replace(
    v_update,
    E'FROM public.drivers d\n    WHERE d.driver_id <> p_driver_id AND lower(btrim(d.driver_code))',
    E'FROM public.drivers d\n    WHERE d.driver_id <> p_driver_id AND d.is_active = true AND lower(btrim(d.driver_code))'
  );

  IF v_create NOT LIKE '%d.is_active = true%' OR v_update NOT LIKE '%d.is_active = true%' THEN
    RAISE EXCEPTION 'Could not safely patch driver duplicate checks';
  END IF;

  EXECUTE v_create;
  EXECUTE v_update;
END
$migration$;

NOTIFY pgrst, 'reload schema';
