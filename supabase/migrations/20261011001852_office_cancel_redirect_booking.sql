-- Phase 1: office-only cancellation and destination redirect for an individual booking.
-- Historical actual-load rows are retained; no hard deletes.
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
  WHERE b.load_order_id=v_booking.load_order_id
    AND b.status IN ('BOOKED','LOADING_STATEMENT','IN_TRANSIT');
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

CREATE OR REPLACE FUNCTION public.office_redirect_booking(
  p_booking_id uuid,
  p_factory_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_auth uuid := auth.uid();
  v_actor uuid;
  v_booking public.bookings%ROWTYPE;
  v_actual public.actual_loading_records%ROWTYPE;
  v_factory_name text;
BEGIN
  IF v_auth IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT au.user_id INTO v_actor FROM public.app_users au
  JOIN public.user_roles ur ON ur.user_id=au.user_id
  JOIN public.roles r ON r.role_id=ur.role_id
  WHERE au.auth_user_id=v_auth AND au.is_active=true
    AND r.name IN ('ADMIN','HEAD_OFFICE','BRANCH') LIMIT 1;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;
  IF p_reason IS NULL OR btrim(p_reason)='' THEN RAISE EXCEPTION 'REDIRECT_REASON_REQUIRED'; END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE booking_id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;
  IF v_booking.status NOT IN ('BOOKED','LOADING_STATEMENT','IN_TRANSIT') THEN
    RAISE EXCEPTION 'TRIP_NOT_ACTIVE';
  END IF;
  SELECT * INTO v_actual FROM public.actual_loading_records WHERE booking_id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACTUAL_LOAD_RECORD_NOT_FOUND'; END IF;
  IF v_actual.delivery_confirmed_at IS NOT NULL THEN RAISE EXCEPTION 'TRIP_ALREADY_DELIVERED'; END IF;
  SELECT f.name INTO v_factory_name FROM public.factories f WHERE f.factory_id=p_factory_id AND f.is_active=true;
  IF v_factory_name IS NULL THEN RAISE EXCEPTION 'FACTORY_NOT_FOUND_OR_INACTIVE'; END IF;
  IF v_actual.factory_id=p_factory_id THEN RAISE EXCEPTION 'SAME_DESTINATION'; END IF;

  UPDATE public.actual_loading_records SET factory_id=p_factory_id WHERE actual_load_id=v_actual.actual_load_id;
  INSERT INTO public.audit_log(actor_user_id,action,entity_type,entity_id,old_data,new_data)
  VALUES(v_actor,'BOOKING_DESTINATION_REDIRECTED','booking',p_booking_id::text,
    jsonb_build_object('factory_id',v_actual.factory_id,'actual_load_id',v_actual.actual_load_id),
    jsonb_build_object('factory_id',p_factory_id,'factory_name',v_factory_name,'reason',btrim(p_reason)));
  RETURN jsonb_build_object('success',true,'booking_id',p_booking_id,'factory_id',p_factory_id,'factory_name',v_factory_name);
END;
$function$;

REVOKE ALL ON FUNCTION public.office_cancel_booking(uuid,text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.office_cancel_booking(uuid,text,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.office_cancel_booking(uuid,text,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.office_redirect_booking(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.office_redirect_booking(uuid,uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.office_redirect_booking(uuid,uuid,text) TO authenticated;
