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
  v_actual_record_exists boolean;
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

  SELECT EXISTS (
    SELECT 1 FROM public.actual_loading_records
    WHERE booking_id = v_booking.booking_id
  ) INTO v_actual_record_exists;
  IF NOT v_actual_record_exists THEN
    RAISE EXCEPTION 'ACTUAL_LOADING_RECORD_NOT_FOUND';
  END IF;

  UPDATE public.actual_loading_records
  SET actual_weight = p_actual_weight,
      scale_image_path = p_scale_image_path,
      delivery_confirmed_at = now(),
      delivery_latitude = p_latitude,
      delivery_longitude = p_longitude
  WHERE booking_id = v_booking.booking_id
    AND delivery_confirmed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DELIVERY_ALREADY_CONFIRMED';
  END IF;

  INSERT INTO public.location_events (
    driver_id, vehicle_id, office_id, event_type, latitude, longitude, recorded_at
  )
  VALUES (
    v_booking.driver_id, v_booking.vehicle_id, v_load.check_in_office_id,
    'DELIVERY_CONFIRMED', p_latitude, p_longitude, now()
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
    UPDATE public.load_orders SET status = 'DELIVERED'
    WHERE load_order_id = v_load.load_order_id;
  ELSIF v_active_count = 0 THEN
    UPDATE public.load_orders SET status = 'PUBLISHED'
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
