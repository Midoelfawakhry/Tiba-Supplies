-- Read-only account statement source for office reporting.
-- Preserve the deployed Main Office authorization guard and resolve missing trip fields
-- from the linked booking/load order without inventing factory/quarry relationships.
CREATE OR REPLACE FUNCTION public.get_account_statement_records(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.current_main_office_user();

  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
    RAISE EXCEPTION 'INVALID_DATE_RANGE';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'actual_load_id', alr.actual_load_id,
    'booking_id', alr.booking_id,
    'load_date', COALESCE(alr.load_date, alr.loaded_at::date),
    'loading_sequence_date', COALESCE(alr.loading_sequence_date, alr.load_date, alr.loaded_at::date),
    'created_at', alr.created_at,
    'trip_code', COALESCE(alr.trip_code, b.trip_code),
    'daily_load_number', COALESCE(alr.daily_load_number, lo.order_number),
    'ticket_number', alr.ticket_number,
    'actual_weight', alr.actual_weight,
    'vehicle_id', COALESCE(alr.vehicle_id, b.vehicle_id),
    'plate_number', v.plate_number,
    'vehicle_code', v.vehicle_code,
    'owner_id', v.owner_id,
    'owner_name', vo.name,
    'driver_id', COALESCE(alr.driver_id, b.driver_id),
    'driver_name', d.name,
    'factory_id', COALESCE(alr.factory_id, lo.factory_id),
    'factory_name', f.name,
    'quarry_id', COALESCE(alr.quarry_id, lo.quarry_id),
    'quarry_name', q.name,
    'scale_image_path', alr.scale_image_path,
    'delivery_confirmed_at', dc.confirmed_at,
    'actual_weight_recorded_at', alr.actual_weight_recorded_at,
    'record_source', alr.record_source,
    'source_record_id', alr.source_record_id,
    'source_file_name', alr.source_file_name,
    'source_row_number', alr.source_row_number,
    'imported_at', alr.imported_at
  ) ORDER BY COALESCE(alr.load_date, alr.loaded_at::date, alr.created_at::date) DESC, alr.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM public.actual_loading_records alr
  LEFT JOIN public.bookings b ON b.booking_id = alr.booking_id
  LEFT JOIN public.load_orders lo ON lo.load_order_id = b.load_order_id
  LEFT JOIN public.vehicles v ON v.vehicle_id = COALESCE(alr.vehicle_id, b.vehicle_id)
  LEFT JOIN public.vehicle_owners vo ON vo.owner_id = v.owner_id
  LEFT JOIN public.drivers d ON d.driver_id = COALESCE(alr.driver_id, b.driver_id)
  LEFT JOIN public.factories f ON f.factory_id = COALESCE(alr.factory_id, lo.factory_id)
  LEFT JOIN public.quarries q ON q.quarry_id = COALESCE(alr.quarry_id, lo.quarry_id)
  LEFT JOIN public.delivery_confirmations dc ON dc.booking_id = b.booking_id
  WHERE (p_from IS NULL OR COALESCE(alr.load_date, alr.loaded_at::date, alr.created_at::date) >= p_from)
    AND (p_to IS NULL OR COALESCE(alr.load_date, alr.loaded_at::date, alr.created_at::date) <= p_to);

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_account_statement_records(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_account_statement_records(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_account_statement_records(date, date) TO authenticated;
