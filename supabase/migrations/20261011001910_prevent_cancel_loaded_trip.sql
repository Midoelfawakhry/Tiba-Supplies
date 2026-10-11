-- Prevent cancellation of a trip that has already left loaded; redirect its destination instead.
CREATE OR REPLACE FUNCTION public.office_cancel_booking(
  p_booking_id uuid,
  p_reason text,
  p_vehicle_out_of_service boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_auth uuid := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_actual public.actual_loading_records%ROWTYPE;
  v_order public.load_orders%ROWTYPE;
  v_actor uuid;
  v_active_count integer;
BEGIN
  IF v_auth IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT au.user_id INTO v_actor FROM public.app_users au
  JOIN public.user_roles ur ON ur.user_id=au.user_id
  JOIN public.roles r ON r.role_id=ur.role_id
  WHERE au.auth_user_id=v_auth AND au.is_active=true
    AND r.name IN ('ADMIN','HEAD_OFFICE','BRANCH') LIMIT 1;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;
  IF p_reason IS NULL OR btrim(p_reason)='' THEN RAISE EXCEPTION 'CANCEL_REASON_REQUIRED'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE booking_id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;
  IF v_booking.status IN ('DELIVERED','COMPLETED') THEN RAISE EXCEPTION 'TRIP_ALREADY_DELIVERED'; END IF;
  IF v_booking.status='IN_TRANSIT' THEN RAISE EXCEPTION 'USE_REDIRECT_FOR_LOADED_TRIP'; END IF;
  SELECT * INTO v_actual FROM public.actual_loading_records WHERE booking_id=p_booking_id FOR UPDATE;
  IF v_actual.actual_weight IS NOT NULL OR v_actual.delivery_confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'ACTUAL_DELIVERY_ALREADY_RECORDED';
  END IF;
  SELECT * INTO v_order FROM public.load_orders WHERE load_order_id=v_booking.load_order_id FOR UPDATE;
  IF v_booking.status='CANCELLED' THEN RAISE EXCEPTION 'BOOKING_ALREADY_CANCELLED'; END IF;
  UPDATE public.bookings SET status='CANCELLED' WHERE booking_id=p_booking_id;
  UPDATE public.waiting_list_entries SET status='LEFT_QUEUE'
  WHERE driver_id=v_booking.driver_id AND vehicle_id=v_booking.vehicle_id
    AND status IN ('WAITING','SELECTED','ASSIGNED');
  IF NOT p_vehicle_out_of_service THEN
    INSERT INTO public.waiting_list_entries(driver_id,vehicle_id,office_id,arrived_at,status)
    VALUES(v_booking.driver_id,v_booking.vehicle_id,v_order.check_in_office_id,now(),'WAITING');
  END IF;
  SELECT count(*) INTO v_active_count FROM public.bookings b
  WHERE b.load_order_id=v_booking.load_order_id AND b.status IN ('BOOKED','LOADING_STATEMENT','IN_TRANSIT');
  IF v_active_count=0 AND v_order.status NOT IN ('CANCELLED','COMPLETED','DELIVERED') THEN
    UPDATE public.load_orders SET status='PUBLISHED' WHERE load_order_id=v_order.load_order_id;
  END IF;
  INSERT INTO public.audit_log(actor_user_id,action,entity_type,entity_id,old_data,new_data)
  VALUES(v_actor,'BOOKING_CANCELLED','booking',p_booking_id::text,
    jsonb_build_object('status',v_booking.status,'vehicle_id',v_booking.vehicle_id,'load_order_id',v_booking.load_order_id),
    jsonb_build_object('status','CANCELLED','reason',btrim(p_reason),'vehicle_out_of_service',p_vehicle_out_of_service,'returned_to_waiting_list',NOT p_vehicle_out_of_service));
  RETURN jsonb_build_object('success',true,'booking_id',p_booking_id,'status','CANCELLED','returned_to_waiting_list',NOT p_vehicle_out_of_service);
END;
$function$;