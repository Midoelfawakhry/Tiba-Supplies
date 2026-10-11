-- Phase 1 corrective migration: cancellation and redirect business rules.
-- HEAD owns operational transactions; BRANCH is a geofence/reference office only.
-- Forward-only candidate. Apply to isolated staging only after migration reconciliation.
-- Cancellation is blocked by actual weight/delivery evidence, not IN_TRANSIT status alone.

CREATE OR REPLACE FUNCTION public.office_cancel_booking(
  p_booking_id uuid,
  p_reason text,
  p_vehicle_out_of_service boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth uuid := auth.uid();
  v_actor uuid;
  v_head_office_id uuid;
  v_booking public.bookings%ROWTYPE;
  v_actual public.actual_loading_records%ROWTYPE;
  v_order public.load_orders%ROWTYPE;
  v_direct public.standalone_direct_load_audit%ROWTYPE;
  v_active_count integer := 0;
  v_queue_entry_id uuid;
BEGIN
  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  -- Resolve the acting user and enforce the operational-office boundary server-side.
  SELECT au.user_id INTO v_actor
  FROM public.app_users au
  JOIN public.user_roles ur ON ur.user_id = au.user_id
  JOIN public.roles r ON r.role_id = ur.role_id
  WHERE au.auth_user_id = v_auth
    AND au.is_active = true
    AND r.name IN ('ADMIN', 'HEAD_OFFICE')
  LIMIT 1;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'CANCEL_REASON_REQUIRED';
  END IF;

  SELECT o.office_id INTO v_head_office_id
  FROM public.offices o
  WHERE o.office_type = 'HEAD' AND o.is_active = true
  ORDER BY o.created_at, o.name
  LIMIT 1;

  IF v_head_office_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_HEAD_OFFICE_NOT_CONFIGURED';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE booking_id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND';
  END IF;
  IF v_booking.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'BOOKING_ALREADY_CANCELLED';
  END IF;
  IF v_booking.status IN ('DELIVERED', 'COMPLETED') THEN
    RAISE EXCEPTION 'TRIP_ALREADY_DELIVERED';
  END IF;
  -- IN_TRANSIT alone is not a cancellation blocker. Actual weight or delivery evidence below is.

  SELECT * INTO v_actual
  FROM public.actual_loading_records
  WHERE booking_id = p_booking_id
  FOR UPDATE;

  IF FOUND AND (
    v_actual.actual_weight IS NOT NULL
    OR v_actual.delivery_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'ACTUAL_DELIVERY_ALREADY_RECORDED';
  END IF;

  IF v_booking.load_order_id IS NOT NULL THEN
    SELECT * INTO v_order
    FROM public.load_orders
    WHERE load_order_id = v_booking.load_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'LOAD_ORDER_NOT_FOUND';
    END IF;
    IF v_order.office_id IS DISTINCT FROM v_head_office_id THEN
      RAISE EXCEPTION 'LOAD_NOT_OWNED_BY_HEAD_OFFICE';
    END IF;
  ELSE
    SELECT * INTO v_direct
    FROM public.standalone_direct_load_audit
    WHERE booking_id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DIRECT_ASSIGNMENT_AUDIT_NOT_FOUND';
    END IF;
    IF v_direct.office_id IS DISTINCT FROM v_head_office_id THEN
      RAISE EXCEPTION 'DIRECT_ASSIGNMENT_NOT_OWNED_BY_HEAD_OFFICE';
    END IF;
  END IF;

  -- All queue changes are scoped to HEAD. Clear active entries for this driver
  -- across vehicles first so the cancellation can never create a duplicate active
  -- driver/office entry. The unique active-entry constraint remains the final guard.
  UPDATE public.waiting_list_entries
  SET status = 'LEFT_QUEUE'
  WHERE driver_id = v_booking.driver_id
    AND office_id = v_head_office_id
    AND status IN ('WAITING', 'SELECTED', 'ASSIGNED');

  UPDATE public.waiting_list_entries
  SET status = 'LEFT_QUEUE'
  WHERE driver_id = v_booking.driver_id
    AND vehicle_id = v_booking.vehicle_id
    AND status IN ('WAITING', 'SELECTED', 'ASSIGNED');

  UPDATE public.bookings
  SET status = 'CANCELLED'
  WHERE booking_id = p_booking_id;

  IF NOT p_vehicle_out_of_service THEN
    INSERT INTO public.waiting_list_entries (
      driver_id, vehicle_id, office_id, arrived_at, status
    )
    VALUES (
      v_booking.driver_id, v_booking.vehicle_id, v_head_office_id, now(), 'WAITING'
    )
    RETURNING entry_id INTO v_queue_entry_id;
  END IF;

  IF v_booking.load_order_id IS NOT NULL THEN
    SELECT count(*) INTO v_active_count
    FROM public.bookings b
    WHERE b.load_order_id = v_booking.load_order_id
      AND b.status IN ('BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT');

    IF v_active_count = 0
       AND v_order.status NOT IN ('CANCELLED', 'COMPLETED', 'DELIVERED') THEN
      UPDATE public.load_orders
      SET status = 'PUBLISHED'
      WHERE load_order_id = v_booking.load_order_id;
    END IF;
  END IF;

  INSERT INTO public.audit_log (
    actor_user_id, action, entity_type, entity_id, old_data, new_data
  )
  VALUES (
    v_actor,
    'BOOKING_CANCELLED',
    'booking',
    p_booking_id::text,
    jsonb_build_object(
      'status', v_booking.status,
      'vehicle_id', v_booking.vehicle_id,
      'driver_id', v_booking.driver_id,
      'load_order_id', v_booking.load_order_id,
      'direct_assignment', v_booking.load_order_id IS NULL
    ),
    jsonb_build_object(
      'status', 'CANCELLED',
      'reason', btrim(p_reason),
      'vehicle_out_of_service', p_vehicle_out_of_service,
      'returned_to_waiting_list', NOT p_vehicle_out_of_service,
      'queue_entry_id', v_queue_entry_id,
      'operational_office_id', v_head_office_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'status', 'CANCELLED',
    'returned_to_waiting_list', NOT p_vehicle_out_of_service,
    'queue_entry_id', v_queue_entry_id,
    'operational_office_id', v_head_office_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.office_cancel_booking(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_cancel_booking(uuid, text, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- Redirect is a corrective destination change. It may be used after weight or delivery,
-- but the existing actual-load row, weight, scale evidence, and delivery timestamps remain intact.
CREATE OR REPLACE FUNCTION public.office_redirect_booking(
  p_booking_id uuid,
  p_factory_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth uuid := auth.uid();
  v_actor uuid;
  v_head_office_id uuid;
  v_booking public.bookings%ROWTYPE;
  v_actual public.actual_loading_records%ROWTYPE;
  v_order public.load_orders%ROWTYPE;
  v_direct public.standalone_direct_load_audit%ROWTYPE;
  v_old_factory_name text;
  v_new_factory_name text;
  v_delivery_confirmed boolean := false;
BEGIN
  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT au.user_id INTO v_actor
  FROM public.app_users au
  JOIN public.user_roles ur ON ur.user_id = au.user_id
  JOIN public.roles r ON r.role_id = ur.role_id
  WHERE au.auth_user_id = v_auth
    AND au.is_active = true
    AND r.name IN ('ADMIN', 'HEAD_OFFICE')
  LIMIT 1;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'REDIRECT_REASON_REQUIRED';
  END IF;

  SELECT o.office_id INTO v_head_office_id
  FROM public.offices o
  WHERE o.office_type = 'HEAD' AND o.is_active = true
  ORDER BY o.created_at, o.name
  LIMIT 1;
  IF v_head_office_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_HEAD_OFFICE_NOT_CONFIGURED';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE booking_id = p_booking_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND';
  END IF;
  IF v_booking.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'TRIP_CANCELLED';
  END IF;
  IF v_booking.status NOT IN ('BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED') THEN
    RAISE EXCEPTION 'TRIP_NOT_REDIRECTABLE';
  END IF;

  IF v_booking.load_order_id IS NOT NULL THEN
    SELECT * INTO v_order
    FROM public.load_orders
    WHERE load_order_id = v_booking.load_order_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'LOAD_ORDER_NOT_FOUND';
    END IF;
    IF v_order.office_id IS DISTINCT FROM v_head_office_id THEN
      RAISE EXCEPTION 'LOAD_NOT_OWNED_BY_HEAD_OFFICE';
    END IF;
  ELSE
    SELECT * INTO v_direct
    FROM public.standalone_direct_load_audit
    WHERE booking_id = p_booking_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'DIRECT_ASSIGNMENT_AUDIT_NOT_FOUND';
    END IF;
    IF v_direct.office_id IS DISTINCT FROM v_head_office_id THEN
      RAISE EXCEPTION 'DIRECT_ASSIGNMENT_NOT_OWNED_BY_HEAD_OFFICE';
    END IF;
  END IF;

  SELECT * INTO v_actual
  FROM public.actual_loading_records
  WHERE booking_id = p_booking_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTUAL_LOAD_RECORD_NOT_FOUND';
  END IF;

  SELECT f.name INTO v_old_factory_name
  FROM public.factories f
  WHERE f.factory_id = v_actual.factory_id;
  SELECT f.name INTO v_new_factory_name
  FROM public.factories f
  WHERE f.factory_id = p_factory_id AND f.is_active = true;
  IF v_new_factory_name IS NULL THEN
    RAISE EXCEPTION 'FACTORY_NOT_FOUND_OR_INACTIVE';
  END IF;
  IF v_actual.factory_id = p_factory_id THEN
    RAISE EXCEPTION 'SAME_DESTINATION';
  END IF;

  v_delivery_confirmed := v_actual.delivery_confirmed_at IS NOT NULL
    OR v_booking.status IN ('DELIVERED', 'COMPLETED');

  -- Deliberately update only destination. Preserve weight, scale image, delivery time,
  -- delivery coordinates, booking status, and the actual-load row identity.
  UPDATE public.actual_loading_records
  SET factory_id = p_factory_id
  WHERE actual_load_id = v_actual.actual_load_id;

  INSERT INTO public.audit_log (
    actor_user_id, action, entity_type, entity_id, old_data, new_data
  )
  VALUES (
    v_actor,
    CASE WHEN v_delivery_confirmed
      THEN 'BOOKING_DESTINATION_CORRECTED_AFTER_DELIVERY'
      ELSE 'BOOKING_DESTINATION_REDIRECTED'
    END,
    'booking',
    p_booking_id::text,
    jsonb_build_object(
      'actual_load_id', v_actual.actual_load_id,
      'booking_status', v_booking.status,
      'factory_id', v_actual.factory_id,
      'factory_name', v_old_factory_name,
      'actual_weight', v_actual.actual_weight,
      'delivery_confirmed_at', v_actual.delivery_confirmed_at
    ),
    jsonb_build_object(
      'actual_load_id', v_actual.actual_load_id,
      'factory_id', p_factory_id,
      'factory_name', v_new_factory_name,
      'reason', btrim(p_reason),
      'corrective_after_delivery', v_delivery_confirmed,
      'actual_weight_preserved', v_actual.actual_weight,
      'delivery_confirmed_at_preserved', v_actual.delivery_confirmed_at
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'factory_id', p_factory_id,
    'factory_name', v_new_factory_name,
    'corrective_after_delivery', v_delivery_confirmed
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.office_redirect_booking(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_redirect_booking(uuid, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
