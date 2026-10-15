-- Phase 1 reporting: preserve vehicle-owner attribution at actual-load creation.
-- Historical rows are intentionally NOT backfilled from current vehicle ownership:
-- that would silently reassign old trips when a vehicle's owner has changed.
ALTER TABLE public.actual_loading_records
  ADD COLUMN IF NOT EXISTS vehicle_owner_id_snapshot uuid,
  ADD COLUMN IF NOT EXISTS vehicle_owner_name_snapshot text;

CREATE OR REPLACE FUNCTION public.capture_actual_load_owner_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  -- Capture once, when the actual-loading row is first created.
  -- Never overwrite an existing snapshot during later edits.
  IF NEW.vehicle_owner_id_snapshot IS NULL AND NEW.vehicle_owner_name_snapshot IS NULL THEN
    SELECT v.owner_id, vo.name
      INTO NEW.vehicle_owner_id_snapshot, NEW.vehicle_owner_name_snapshot
    FROM public.bookings b
    JOIN public.vehicles v ON v.vehicle_id = b.vehicle_id
    LEFT JOIN public.vehicle_owners vo ON vo.owner_id = v.owner_id
    WHERE b.booking_id = NEW.booking_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS actual_load_owner_snapshot_before_insert ON public.actual_loading_records;
CREATE TRIGGER actual_load_owner_snapshot_before_insert
BEFORE INSERT ON public.actual_loading_records
FOR EACH ROW EXECUTE FUNCTION public.capture_actual_load_owner_snapshot();

CREATE OR REPLACE FUNCTION public.get_vehicle_owner_reports(p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.auth_user_id = auth.uid() AND au.is_active = true
      AND au.role IN ('ADMIN','HEAD_OFFICE','BRANCH')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
    RAISE EXCEPTION 'INVALID_DATE_RANGE';
  END IF;

  SELECT jsonb_build_object(
    'vehicles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'vehicle_id', v.vehicle_id, 'plate_number', v.plate_number,
        'vehicle_code', v.vehicle_code, 'owner_id', v.owner_id,
        'owner_name', vo.name, 'owner_phone', vo.phone, 'is_active', v.is_active
      ) ORDER BY v.plate_number)
      FROM public.vehicles v LEFT JOIN public.vehicle_owners vo ON vo.owner_id = v.owner_id
    ), '[]'::jsonb),
    'owners', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'owner_id', vo.owner_id, 'name', vo.name, 'phone', vo.phone,
        'is_active', vo.is_active,
        'vehicle_count', (SELECT count(*) FROM public.vehicles v2 WHERE v2.owner_id = vo.owner_id)
      ) ORDER BY vo.name)
      FROM public.vehicle_owners vo
    ), '[]'::jsonb),
    'trips', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'actual_load_id', alr.actual_load_id, 'booking_id', b.booking_id,
        'trip_code', b.trip_code, 'daily_load_number', lo.order_number,
        'loading_sequence_date', alr.loaded_at::date, 'load_date', alr.loaded_at::date,
        'created_at', alr.created_at, 'vehicle_id', b.vehicle_id,
        'plate_number', v.plate_number, 'vehicle_code', v.vehicle_code,
        'owner_id', alr.vehicle_owner_id_snapshot,
        'owner_name', alr.vehicle_owner_name_snapshot,
        'driver_name', d.name, 'quarry_name', q.name, 'factory_name', f.name,
        'ticket_number', alr.ticket_number, 'actual_weight', alr.actual_weight,
        'scale_image_path', alr.scale_image_path, 'delivery_confirmed_at', dc.confirmed_at,
        'is_completed', (dc.confirmed_at IS NOT NULL AND alr.actual_weight IS NOT NULL),
        'owner_attribution_status', CASE
          WHEN alr.vehicle_owner_id_snapshot IS NULL THEN 'UNKNOWN_LEGACY'
          ELSE 'SNAPSHOTTED'
        END
      ) ORDER BY alr.loaded_at DESC, alr.created_at DESC)
      FROM public.actual_loading_records alr
      JOIN public.bookings b ON b.booking_id = alr.booking_id
      JOIN public.load_orders lo ON lo.load_order_id = b.load_order_id
      LEFT JOIN public.vehicles v ON v.vehicle_id = b.vehicle_id
      LEFT JOIN public.drivers d ON d.driver_id = b.driver_id
      LEFT JOIN public.factories f ON f.factory_id = lo.factory_id
      LEFT JOIN public.quarries q ON q.quarry_id = lo.quarry_id
      LEFT JOIN public.delivery_confirmations dc ON dc.booking_id = b.booking_id
      WHERE (p_from IS NULL OR alr.loaded_at::date >= p_from)
        AND (p_to IS NULL OR alr.loaded_at::date <= p_to)
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_account_statement_records(p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users au
    WHERE au.auth_user_id = auth.uid() AND au.is_active = true
      AND au.role IN ('ADMIN','HEAD_OFFICE')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
    RAISE EXCEPTION 'INVALID_DATE_RANGE';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'actual_load_id', alr.actual_load_id, 'booking_id', b.booking_id,
    'load_date', alr.loaded_at::date, 'loading_sequence_date', alr.loaded_at::date,
    'created_at', alr.created_at, 'trip_code', b.trip_code, 'daily_load_number', lo.order_number,
    'ticket_number', alr.ticket_number, 'actual_weight', alr.actual_weight,
    'vehicle_id', b.vehicle_id, 'plate_number', v.plate_number,
    'vehicle_owner_id', alr.vehicle_owner_id_snapshot,
    'vehicle_owner_name', alr.vehicle_owner_name_snapshot,
    'driver_id', b.driver_id, 'driver_name', d.name,
    'factory_id', lo.factory_id, 'factory_name', f.name,
    'quarry_id', lo.quarry_id, 'quarry_name', q.name,
    'scale_image_path', alr.scale_image_path, 'delivery_confirmed_at', dc.confirmed_at,
    'owner_attribution_status', CASE
      WHEN alr.vehicle_owner_id_snapshot IS NULL THEN 'UNKNOWN_LEGACY'
      ELSE 'SNAPSHOTTED'
    END
  ) ORDER BY alr.loaded_at DESC, alr.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM public.actual_loading_records alr
  JOIN public.bookings b ON b.booking_id = alr.booking_id
  JOIN public.load_orders lo ON lo.load_order_id = b.load_order_id
  LEFT JOIN public.vehicles v ON v.vehicle_id = b.vehicle_id
  LEFT JOIN public.drivers d ON d.driver_id = b.driver_id
  LEFT JOIN public.factories f ON f.factory_id = lo.factory_id
  LEFT JOIN public.quarries q ON q.quarry_id = lo.quarry_id
  LEFT JOIN public.delivery_confirmations dc ON dc.booking_id = b.booking_id
  WHERE (p_from IS NULL OR alr.loaded_at::date >= p_from)
    AND (p_to IS NULL OR alr.loaded_at::date <= p_to);
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_vehicle_owner_reports(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_owner_reports(date,date) TO authenticated;
REVOKE ALL ON FUNCTION public.get_account_statement_records(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_account_statement_records(date,date) TO authenticated;

COMMENT ON COLUMN public.actual_loading_records.vehicle_owner_id_snapshot IS
  'Owner attribution captured when actual-loading row is created; NULL on legacy rows with unknown historical attribution.';
COMMENT ON COLUMN public.actual_loading_records.vehicle_owner_name_snapshot IS
  'Owner display name captured with the actual-loading row; immutable historical reporting label.';
