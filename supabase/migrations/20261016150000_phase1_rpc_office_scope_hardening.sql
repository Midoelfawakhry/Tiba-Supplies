-- Phase 1: scope reporting RPCs to the authenticated user's operational office.
-- Prepared for review only; do not apply until shadow test coverage is run.
-- Target: awgppfjxegognuqozldl (the backend embedded in Android v191).
-- No production project changes are authorized by this migration.

CREATE OR REPLACE FUNCTION public.get_vehicle_owner_reports(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  -- This is a head-office reporting screen. Branch users have a separate
  -- branch-scoped snapshot and must not receive the global owner/trip report.
  PERFORM public.current_main_office_user();

  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
    RAISE EXCEPTION 'INVALID_DATE_RANGE';
  END IF;

  SELECT jsonb_build_object(
    'vehicles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'vehicle_id', v.vehicle_id,
        'plate_number', v.plate_number,
        'vehicle_code', v.vehicle_code,
        'owner_id', vo.owner_id,
        'owner_name', vo.name,
        'owner_phone', vo.phone,
        'is_active', v.is_active
      ) ORDER BY v.plate_number)
      FROM public.vehicles v
      LEFT JOIN public.vehicle_owners vo ON vo.owner_id = v.owner_id
    ), '[]'::jsonb),
    'owners', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'owner_id', vo.owner_id,
        'name', vo.name,
        'phone', vo.phone,
        'is_active', vo.is_active,
        'vehicle_count', (
          SELECT count(*) FROM public.vehicles v2 WHERE v2.owner_id = vo.owner_id
        )
      ) ORDER BY vo.name)
      FROM public.vehicle_owners vo
    ), '[]'::jsonb),
    'trips', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'actual_load_id', alr.actual_load_id,
        'booking_id', b.booking_id,
        'trip_code', b.trip_code,
        'daily_load_number', lo.order_number,
        'loading_sequence_date', alr.loaded_at::date,
        'load_date', alr.loaded_at::date,
        'created_at', alr.created_at,
        'vehicle_id', v.vehicle_id,
        'plate_number', v.plate_number,
        'vehicle_code', v.vehicle_code,
        'owner_id', vo.owner_id,
        'owner_name', vo.name,
        'driver_name', d.name,
        'quarry_name', q.name,
        'factory_name', f.name,
        'ticket_number', alr.ticket_number,
        'actual_weight', alr.actual_weight,
        'scale_image_path', alr.scale_image_path,
        'delivery_confirmed_at', dc.confirmed_at,
        'is_completed', (dc.confirmed_at IS NOT NULL AND alr.actual_weight IS NOT NULL)
      ) ORDER BY alr.loaded_at DESC, alr.created_at DESC)
      FROM public.actual_loading_records alr
      JOIN public.bookings b ON b.booking_id = alr.booking_id
      JOIN public.load_orders lo ON lo.load_order_id = b.load_order_id
      LEFT JOIN public.vehicles v ON v.vehicle_id = b.vehicle_id
      LEFT JOIN public.vehicle_owners vo ON vo.owner_id = v.owner_id
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

CREATE OR REPLACE FUNCTION public.get_account_statement_records(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  -- Account statements are head-office-only; validate the active MAIN office
  -- assignment, not just the role name.
  PERFORM public.current_main_office_user();

  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
    RAISE EXCEPTION 'INVALID_DATE_RANGE';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'actual_load_id', alr.actual_load_id,
    'booking_id', b.booking_id,
    'load_date', alr.loaded_at::date,
    'loading_sequence_date', alr.loaded_at::date,
    'created_at', alr.created_at,
    'trip_code', b.trip_code,
    'daily_load_number', lo.order_number,
    'ticket_number', alr.ticket_number,
    'actual_weight', alr.actual_weight,
    'vehicle_id', b.vehicle_id,
    'plate_number', v.plate_number,
    'driver_id', b.driver_id,
    'driver_name', d.name,
    'factory_id', lo.factory_id,
    'factory_name', f.name,
    'quarry_id', lo.quarry_id,
    'quarry_name', q.name,
    'scale_image_path', alr.scale_image_path,
    'delivery_confirmed_at', dc.confirmed_at
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

CREATE OR REPLACE FUNCTION public.get_office_waiting_list()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_office public.offices%rowtype;
  v_window public.dispatch_windows%rowtype;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT au.role INTO v_role
  FROM public.app_users au
  WHERE au.auth_user_id = v_uid
    AND au.is_active = true
  LIMIT 1;

  IF v_role = 'BRANCH' THEN
    -- The queue belongs specifically to the active RAS_SEDR branch.
    PERFORM public.current_ras_sedr_branch_user();
  ELSIF v_role IN ('ADMIN', 'HEAD_OFFICE') THEN
    PERFORM public.current_main_office_user();
  ELSE
    RAISE EXCEPTION 'INSUFFICIENT_ROLE';
  END IF;

  SELECT * INTO v_office
  FROM public.offices
  WHERE office_code = 'RAS_SEDR'
    AND office_type = 'BRANCH'
    AND is_active = true;

  IF v_office.office_id IS NULL THEN
    RAISE EXCEPTION 'BRANCH_OFFICE_NOT_CONFIGURED';
  END IF;

  SELECT * INTO v_window
  FROM public.dispatch_windows
  WHERE office_id = v_office.office_id
  ORDER BY opened_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'office_id', v_office.office_id,
    'selection_window',
      CASE WHEN v_window.dispatch_window_id IS NULL THEN NULL ELSE jsonb_build_object(
        'dispatch_window_id', v_window.dispatch_window_id,
        'status', v_window.status,
        'opened_at', v_window.opened_at,
        'selection_ends_at', v_window.selection_ends_at,
        'closed_at', v_window.closed_at
      ) END,
    'entries', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'entry_id', w.entry_id,
        'driver_id', w.driver_id,
        'driver_name', d.name,
        'driver_code', d.driver_code,
        'driver_phone', d.phone,
        'arrived_at', w.arrived_at,
        'status', w.status,
        'queue_position', x.position,
        'last_check_in_at', w.last_check_in_at,
        'selected_load_order_id', c.load_order_id,
        'selected_factory_name', sf.name,
        'selected_quarry_name', sq.name,
        'choice_status', c.status,
        'chosen_at', c.chosen_at,
        'trip_code', b.trip_code,
        'booking_id', b.booking_id,
        'vehicle_id', veh.vehicle_id,
        'plate_number', veh.plate_number
      ) ORDER BY w.arrived_at, w.entry_id)
      FROM public.waiting_list_entries w
      JOIN public.drivers d ON d.driver_id = w.driver_id
      LEFT JOIN LATERAL (
        SELECT count(*)::integer + 1 AS position
        FROM public.waiting_list_entries p
        WHERE p.office_id = w.office_id
          AND p.status = 'WAITING'
          AND (p.arrived_at < w.arrived_at OR (p.arrived_at = w.arrived_at AND p.entry_id < w.entry_id))
      ) x ON true
      LEFT JOIN public.driver_load_choices c
        ON c.queue_entry_id = w.entry_id
       AND c.dispatch_window_id = v_window.dispatch_window_id
      LEFT JOIN public.load_orders selected_order ON selected_order.load_order_id = c.load_order_id
      LEFT JOIN public.factories sf ON sf.factory_id = selected_order.factory_id
      LEFT JOIN public.quarries sq ON sq.quarry_id = selected_order.quarry_id
      LEFT JOIN public.bookings b ON b.booking_id = c.assigned_booking_id
      LEFT JOIN LATERAL (
        SELECT v.vehicle_id, v.plate_number
        FROM public.driver_vehicle_assignments a
        JOIN public.vehicles v ON v.vehicle_id = a.vehicle_id AND v.is_active = true
        WHERE a.driver_id = d.driver_id
          AND a.ended_at IS NULL
        ORDER BY a.created_at DESC
        LIMIT 1
      ) veh ON true
      WHERE w.office_id = v_office.office_id
        AND w.status IN ('WAITING', 'ASSIGNED')
    ), '[]'::jsonb)
  );
END;
$function$;

-- CREATE OR REPLACE preserves existing ACLs. Explicitly retain the intended API surface.
REVOKE ALL ON FUNCTION public.get_vehicle_owner_reports(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_owner_reports(date, date) TO authenticated;
REVOKE ALL ON FUNCTION public.get_account_statement_records(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_account_statement_records(date, date) TO authenticated;
REVOKE ALL ON FUNCTION public.get_office_waiting_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_office_waiting_list() TO authenticated;
