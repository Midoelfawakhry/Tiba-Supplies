-- Phase 1: separate the office that issues a load from the site where drivers check in.
-- Apply this migration in Supabase SQL Editor before using the updated live dashboard.
-- Existing Ras Sedr coordinates/radius are intentionally preserved.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.offices
    WHERE office_type = 'HEAD'
      AND is_active = true
  ) THEN
    INSERT INTO public.offices (
      name, office_type, latitude, longitude, geofence_radius_m, is_active
    )
    VALUES (
      'مكتب طيبة للتوريدات - الإسماعيلية',
      'HEAD',
      NULL,
      NULL,
      10000,
      true
    );
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_head_office
  ON public.offices (office_type)
  WHERE office_type = 'HEAD' AND is_active = true;

ALTER TABLE public.load_orders
  ADD COLUMN IF NOT EXISTS check_in_office_id uuid;

-- Existing orders were previously scoped to the only active office (Ras Sedr).
-- Preserve that office as the check-in destination while assigning operational ownership
-- to the new HEAD office in the snapshot and in new order creation workflows.
UPDATE public.load_orders lo
SET check_in_office_id = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.offices o
    WHERE o.office_id = lo.office_id
      AND o.office_type = 'BRANCH'
      AND o.is_active = true
  ) THEN lo.office_id
  ELSE (
    SELECT o.office_id
    FROM public.offices o
    WHERE o.office_type = 'BRANCH' AND o.is_active = true
    ORDER BY o.name
    LIMIT 1
  )
END
WHERE lo.check_in_office_id IS NULL;

-- Move operational ownership to the HEAD office only after preserving the old
-- BRANCH office in check_in_office_id.
UPDATE public.load_orders lo
SET office_id = (
  SELECT o.office_id
  FROM public.offices o
  WHERE o.office_type = 'HEAD' AND o.is_active = true
  ORDER BY o.created_at, o.name
  LIMIT 1
)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.offices current_office
  WHERE current_office.office_id = lo.office_id
    AND current_office.office_type = 'HEAD'
    AND current_office.is_active = true
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.load_orders WHERE check_in_office_id IS NULL
  ) THEN
    RAISE EXCEPTION 'CHECK_IN_OFFICE_BACKFILL_FAILED';
  END IF;
END;
$$;

ALTER TABLE public.load_orders
  ALTER COLUMN check_in_office_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'load_orders_check_in_office_id_fkey'
      AND conrelid = 'public.load_orders'::regclass
  ) THEN
    ALTER TABLE public.load_orders
      ADD CONSTRAINT load_orders_check_in_office_id_fkey
      FOREIGN KEY (check_in_office_id)
      REFERENCES public.offices (office_id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_load_orders_checkin_status_created
  ON public.load_orders (check_in_office_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_phase1_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_operational_office_id uuid;
  v_check_in_office_id uuid;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_auth_user_id
      AND au.is_active = true
      AND r.name IN ('ADMIN', 'HEAD_OFFICE', 'BRANCH')
  ) THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE';
  END IF;

  SELECT o.office_id INTO v_operational_office_id
  FROM public.offices o
  WHERE o.is_active = true AND o.office_type = 'HEAD'
  ORDER BY o.created_at, o.name
  LIMIT 1;

  SELECT o.office_id INTO v_check_in_office_id
  FROM public.offices o
  WHERE o.is_active = true AND o.office_type = 'BRANCH'
  ORDER BY o.name
  LIMIT 1;

  IF v_operational_office_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_HEAD_OFFICE_NOT_CONFIGURED';
  END IF;

  IF v_check_in_office_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_CHECK_IN_OFFICE_NOT_CONFIGURED';
  END IF;

  RETURN jsonb_build_object(
    'office',
      (SELECT to_jsonb(o) FROM public.offices o
       WHERE o.office_id = v_operational_office_id),
    'operational_office',
      (SELECT to_jsonb(o) FROM public.offices o
       WHERE o.office_id = v_operational_office_id),
    'check_in_office',
      (SELECT to_jsonb(o) FROM public.offices o
       WHERE o.office_id = v_check_in_office_id),
    'factories',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.name)
         FROM public.factories f WHERE f.is_active = true),
        '[]'::jsonb
      ),
    'quarries',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(q))
         FROM public.quarries q WHERE q.is_active = true),
        '[]'::jsonb
      ),
    'load_orders',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(lo) ORDER BY lo.created_at DESC)
         FROM public.load_orders lo
         WHERE lo.office_id = v_operational_office_id),
        '[]'::jsonb
      ),
    'bookings',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(b) ORDER BY b.booked_at DESC)
         FROM public.bookings b
         JOIN public.load_orders lo ON lo.load_order_id = b.load_order_id
         WHERE lo.office_id = v_operational_office_id),
        '[]'::jsonb
      ),
    'actual_loading_records',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(alr) ORDER BY alr.created_at DESC)
         FROM public.actual_loading_records alr
         JOIN public.bookings b ON b.booking_id = alr.booking_id
         JOIN public.load_orders lo ON lo.load_order_id = b.load_order_id
         WHERE lo.office_id = v_operational_office_id),
        '[]'::jsonb
      ),
    'drivers',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(d) ORDER BY d.name)
         FROM public.drivers d WHERE d.is_active = true),
        '[]'::jsonb
      ),
    'vehicles',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(v) ORDER BY v.plate_number)
         FROM public.vehicles v WHERE v.is_active = true),
        '[]'::jsonb
      )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_phase1_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_phase1_snapshot() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_phase1_snapshot() TO authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_load(p_load_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_load public.load_orders%ROWTYPE;
  v_entry_id uuid;
  v_driver_id uuid;
  v_vehicle_id uuid;
  v_booking_id uuid;
  v_geofence jsonb;
  v_committed_count integer;
  v_active_count integer;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_auth_user_id
      AND au.is_active = true
      AND r.name IN ('ADMIN', 'HEAD_OFFICE', 'BRANCH')
  ) THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE';
  END IF;

  SELECT * INTO v_load
  FROM public.load_orders
  WHERE load_order_id = p_load_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOAD_ORDER_NOT_FOUND';
  END IF;

  IF v_load.status NOT IN ('PUBLISHED', 'LOADING_STATEMENT') THEN
    RAISE EXCEPTION 'LOAD_ORDER_NOT_DISPATCHABLE';
  END IF;

  IF v_load.check_in_office_id IS NULL THEN
    RAISE EXCEPTION 'CHECK_IN_OFFICE_NOT_CONFIGURED';
  END IF;

  -- Capacity is lifetime fulfilled/reserved quantity, not just currently active bookings.
  -- Cancelled/rejected/no-show/failed bookings release capacity.
  SELECT COUNT(*) INTO v_committed_count
  FROM public.bookings b
  WHERE b.load_order_id = v_load.load_order_id
    AND b.status IN (
      'BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'
    );

  IF v_committed_count >= v_load.requested_quantity THEN
    RAISE EXCEPTION 'LOAD_CAPACITY_REACHED';
  END IF;

  SELECT w.entry_id, w.driver_id, w.vehicle_id
  INTO v_entry_id, v_driver_id, v_vehicle_id
  FROM public.waiting_list_entries w
  JOIN public.drivers d
    ON d.driver_id = w.driver_id AND d.is_active = true
  JOIN public.vehicles v
    ON v.vehicle_id = w.vehicle_id AND v.is_active = true
  JOIN public.vehicle_driver_assignments vda
    ON vda.driver_id = w.driver_id
   AND vda.vehicle_id = w.vehicle_id
   AND vda.assigned_to IS NULL
   AND vda.assigned_from <= now()
  CROSS JOIN LATERAL (
    SELECT public.get_driver_geofence_status(w.driver_id) AS result
  ) geo
  WHERE w.office_id = v_load.check_in_office_id
    AND w.status = 'WAITING'
    AND geo.result->>'eligible' = 'true'
    AND geo.result->>'office_id' = v_load.check_in_office_id::text
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.driver_id = w.driver_id
        AND b.status IN ('BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.vehicle_id = w.vehicle_id
        AND b.status IN ('BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT')
    )
  ORDER BY w.arrived_at
  FOR UPDATE OF w SKIP LOCKED
  LIMIT 1;

  IF v_entry_id IS NULL THEN
    RAISE EXCEPTION 'NO_ELIGIBLE_DRIVER_WAITING_AT_CHECK_IN_OFFICE';
  END IF;

  INSERT INTO public.bookings (
    load_order_id, driver_id, vehicle_id, status, booked_at
  )
  VALUES (
    v_load.load_order_id, v_driver_id, v_vehicle_id, 'BOOKED', now()
  )
  RETURNING booking_id INTO v_booking_id;

  UPDATE public.waiting_list_entries
  SET status = 'ASSIGNED'
  WHERE entry_id = v_entry_id;

  INSERT INTO public.actual_loading_records (
    booking_id, load_date, vehicle_id, driver_id, quarry_id, factory_id, created_at
  )
  VALUES (
    v_booking_id, CURRENT_DATE, v_vehicle_id, v_driver_id,
    v_load.quarry_id, v_load.factory_id, now()
  );

  UPDATE public.bookings
  SET status = 'LOADING_STATEMENT'
  WHERE booking_id = v_booking_id;

  UPDATE public.load_orders
  SET status = 'LOADING_STATEMENT'
  WHERE load_order_id = v_load.load_order_id;

  SELECT COUNT(*) INTO v_active_count
  FROM public.bookings b
  WHERE b.load_order_id = v_load.load_order_id
    AND b.status IN ('BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT');

  RETURN jsonb_build_object(
    'success', true,
    'load_order_id', v_load.load_order_id,
    'booking_id', v_booking_id,
    'driver_id', v_driver_id,
    'vehicle_id', v_vehicle_id,
    'operational_office_id', v_load.office_id,
    'check_in_office_id', v_load.check_in_office_id,
    'requested_quantity', v_load.requested_quantity,
    'committed_quantity', v_committed_count + 1,
    'active_bookings', v_active_count,
    'remaining_quantity', GREATEST(0, v_load.requested_quantity - v_committed_count - 1),
    'status', 'LOADING_STATEMENT'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.dispatch_load(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_load(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.dispatch_load(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.driver_confirm_delivery(
  p_booking_id uuid,
  p_actual_weight numeric,
  p_scale_image_path text,
  p_latitude numeric,
  p_longitude numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_driver_id uuid;
  v_booking public.bookings%ROWTYPE;
  v_load public.load_orders%ROWTYPE;
  v_active_count integer;
  v_delivered_count integer;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF p_actual_weight IS NULL OR p_actual_weight <= 0 THEN
    RAISE EXCEPTION 'INVALID_ACTUAL_WEIGHT';
  END IF;

  IF p_scale_image_path IS NULL OR btrim(p_scale_image_path) = '' THEN
    RAISE EXCEPTION 'SCALE_IMAGE_REQUIRED';
  END IF;

  SELECT d.driver_id INTO v_driver_id
  FROM public.drivers d
  WHERE d.auth_user_id = v_auth_user_id AND d.is_active = true
  LIMIT 1;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_DRIVER_NOT_FOUND';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE booking_id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND OR v_booking.driver_id <> v_driver_id THEN
    RAISE EXCEPTION 'BOOKING_NOT_OWNED_BY_DRIVER';
  END IF;

  IF v_booking.status NOT IN ('LOADING_STATEMENT', 'IN_TRANSIT') THEN
    RAISE EXCEPTION 'BOOKING_NOT_READY_FOR_DELIVERY';
  END IF;

  SELECT * INTO v_load
  FROM public.load_orders
  WHERE load_order_id = v_booking.load_order_id;

  UPDATE public.actual_loading_records
  SET actual_weight = p_actual_weight,
      scale_image_path = p_scale_image_path,
      delivery_confirmed_at = now(),
      delivery_latitude = p_latitude,
      delivery_longitude = p_longitude
  WHERE booking_id = v_booking.booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTUAL_LOADING_RECORD_NOT_FOUND';
  END IF;

  INSERT INTO public.location_events (
    driver_id, vehicle_id, office_id, event_type, latitude, longitude, recorded_at
  )
  VALUES (
    v_booking.driver_id,
    v_booking.vehicle_id,
    v_load.check_in_office_id,
    'DELIVERY_CONFIRMED',
    p_latitude,
    p_longitude,
    now()
  );

  UPDATE public.bookings
  SET status = 'DELIVERED'
  WHERE booking_id = v_booking.booking_id;

  SELECT COUNT(*) INTO v_active_count
  FROM public.bookings b
  WHERE b.load_order_id = v_load.load_order_id
    AND b.status IN ('BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT');

  SELECT COUNT(*) INTO v_delivered_count
  FROM public.bookings b
  WHERE b.load_order_id = v_load.load_order_id
    AND b.status IN ('DELIVERED', 'COMPLETED');

  IF v_delivered_count >= v_load.requested_quantity THEN
    UPDATE public.load_orders
    SET status = 'DELIVERED'
    WHERE load_order_id = v_load.load_order_id;
  ELSIF v_active_count = 0 THEN
    -- More trips are still required; return the order to the dispatchable queue.
    UPDATE public.load_orders
    SET status = 'PUBLISHED'
    WHERE load_order_id = v_load.load_order_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking.booking_id,
    'load_order_id', v_load.load_order_id,
    'actual_weight', p_actual_weight,
    'delivered_quantity', v_delivered_count,
    'requested_quantity', v_load.requested_quantity,
    'active_bookings', v_active_count,
    'load_order_status', CASE
      WHEN v_delivered_count >= v_load.requested_quantity THEN 'DELIVERED'
      WHEN v_active_count = 0 THEN 'PUBLISHED'
      ELSE 'LOADING_STATEMENT'
    END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.driver_confirm_delivery(uuid, numeric, text, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_confirm_delivery(uuid, numeric, text, numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.driver_confirm_delivery(uuid, numeric, text, numeric, numeric) TO authenticated;
