-- Post-migration verification for Phase 1 office separation.
-- Run only AFTER applying 20261010_separate_operational_and_checkin_offices.sql.
-- Read-only checks except for raising an exception if the expected configuration is missing.

DO $$
DECLARE
  v_head_count integer;
  v_branch_count integer;
  v_checkin_id uuid;
  v_checkin_lat numeric;
  v_checkin_lon numeric;
  v_checkin_radius integer;
BEGIN
  SELECT COUNT(*) INTO v_head_count
  FROM public.offices
  WHERE office_type = 'HEAD' AND is_active = true;

  IF v_head_count <> 1 THEN
    RAISE EXCEPTION 'EXPECTED_EXACTLY_ONE_ACTIVE_HEAD_OFFICE; found=%', v_head_count;
  END IF;

  SELECT COUNT(*) INTO v_branch_count
  FROM public.offices
  WHERE office_type = 'BRANCH' AND is_active = true;

  IF v_branch_count < 1 THEN
    RAISE EXCEPTION 'EXPECTED_ACTIVE_CHECK_IN_BRANCH';
  END IF;

  SELECT office_id, latitude, longitude, geofence_radius_m
  INTO v_checkin_id, v_checkin_lat, v_checkin_lon, v_checkin_radius
  FROM public.offices
  WHERE office_type = 'BRANCH' AND is_active = true
  ORDER BY name
  LIMIT 1;

  IF v_checkin_lat IS NULL OR v_checkin_lon IS NULL THEN
    RAISE EXCEPTION 'CHECK_IN_OFFICE_COORDINATES_MISSING';
  END IF;

  IF v_checkin_radius <> 10000 THEN
    RAISE EXCEPTION 'EXPECTED_10KM_CHECK_IN_RADIUS; found=%', v_checkin_radius;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'load_orders'
      AND column_name = 'check_in_office_id'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'LOAD_ORDERS_CHECK_IN_OFFICE_COLUMN_NOT_READY';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.load_orders lo
    LEFT JOIN public.offices op ON op.office_id = lo.office_id
    LEFT JOIN public.offices ci ON ci.office_id = lo.check_in_office_id
    WHERE op.office_type IS DISTINCT FROM 'HEAD'
       OR ci.office_type IS DISTINCT FROM 'BRANCH'
  ) THEN
    RAISE EXCEPTION 'LOAD_ORDER_OFFICE_SEPARATION_INVALID';
  END IF;
END;
$$;

SELECT
  op.name AS operational_office,
  op.office_type AS operational_type,
  ci.name AS check_in_office,
  ci.office_type AS check_in_type,
  ci.geofence_radius_m AS check_in_radius_m,
  (SELECT COUNT(*) FROM public.load_orders lo WHERE lo.office_id = op.office_id) AS operational_orders
FROM public.offices op
CROSS JOIN LATERAL (
  SELECT o.name, o.office_type, o.geofence_radius_m
  FROM public.offices o
  WHERE o.office_type = 'BRANCH' AND o.is_active = true
  ORDER BY o.name
  LIMIT 1
) ci
WHERE op.office_type = 'HEAD' AND op.is_active = true;
