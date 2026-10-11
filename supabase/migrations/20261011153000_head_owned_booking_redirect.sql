-- Reassert the corrected HEAD-owned redirect after the cancellation/redirect rules migration.
-- Preserve weight/delivery evidence and use the same guarded implementation as the preceding correction.

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
