-- Explicit HEAD-only destination redirect; BRANCH remains geofence-only.
-- Forward-only candidate. Validate on isolated staging before production.
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
  v_head_office_id uuid;
  v_order public.load_orders%ROWTYPE;
  v_direct public.standalone_direct_load_audit%ROWTYPE;
BEGIN
  IF v_auth IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT au.user_id INTO v_actor
  FROM public.app_users au
  JOIN public.user_roles ur ON ur.user_id=au.user_id
  JOIN public.roles r ON r.role_id=ur.role_id
  WHERE au.auth_user_id=v_auth AND au.is_active=true
    AND r.name IN ('ADMIN','HEAD_OFFICE')
  LIMIT 1;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;
  IF p_reason IS NULL OR btrim(p_reason)='' THEN RAISE EXCEPTION 'REDIRECT_REASON_REQUIRED'; END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE booking_id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;
  IF v_booking.status NOT IN ('BOOKED','LOADING_STATEMENT') THEN
    RAISE EXCEPTION 'TRIP_NOT_ACTIVE';
  END IF;

  SELECT o.office_id INTO v_head_office_id
  FROM public.offices o
  WHERE o.office_type='HEAD' AND o.is_active=true
  ORDER BY o.created_at, o.name LIMIT 1;
  IF v_head_office_id IS NULL THEN RAISE EXCEPTION 'ACTIVE_HEAD_OFFICE_NOT_CONFIGURED'; END IF;

  SELECT * INTO v_actual FROM public.actual_loading_records WHERE booking_id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACTUAL_LOAD_RECORD_NOT_FOUND'; END IF;
  IF v_actual.delivery_confirmed_at IS NOT NULL OR v_actual.actual_weight IS NOT NULL THEN
    RAISE EXCEPTION 'ACTUAL_DELIVERY_ALREADY_RECORDED';
  END IF;
  IF v_booking.load_order_id IS NOT NULL THEN
    SELECT * INTO v_order FROM public.load_orders
    WHERE load_order_id=v_booking.load_order_id FOR UPDATE;
    IF NOT FOUND OR v_order.office_id IS DISTINCT FROM v_head_office_id THEN
      RAISE EXCEPTION 'LOAD_NOT_OWNED_BY_HEAD_OFFICE';
    END IF;
  ELSE
    SELECT * INTO v_direct FROM public.standalone_direct_load_audit
    WHERE booking_id=p_booking_id FOR UPDATE;
    IF NOT FOUND OR v_direct.office_id IS DISTINCT FROM v_head_office_id THEN
      RAISE EXCEPTION 'DIRECT_ASSIGNMENT_NOT_OWNED_BY_HEAD_OFFICE';
    END IF;
  END IF;



  SELECT f.name INTO v_factory_name
  FROM public.factories f
  WHERE f.factory_id=p_factory_id AND f.is_active=true;
  IF v_factory_name IS NULL THEN RAISE EXCEPTION 'FACTORY_NOT_FOUND_OR_INACTIVE'; END IF;
  IF v_actual.factory_id=p_factory_id THEN RAISE EXCEPTION 'SAME_DESTINATION'; END IF;

  -- Overwrite the destination in place; the previous destination is not stored.
  UPDATE public.actual_loading_records
  SET factory_id=p_factory_id
  WHERE actual_load_id=v_actual.actual_load_id;

  -- Keep only the action metadata and the new destination, not the old factory ID/name.
  INSERT INTO public.audit_log(actor_user_id,action,entity_type,entity_id,old_data,new_data)
  VALUES(v_actor,'BOOKING_DESTINATION_REDIRECTED','booking',p_booking_id::text,
    jsonb_build_object('actual_load_id',v_actual.actual_load_id),
    jsonb_build_object('factory_id',p_factory_id,'factory_name',v_factory_name,'reason',btrim(p_reason)));

  RETURN jsonb_build_object('success',true,'booking_id',p_booking_id,'factory_id',p_factory_id,'factory_name',v_factory_name);
END;
$function$;

REVOKE ALL ON FUNCTION public.office_redirect_booking(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.office_redirect_booking(uuid,uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.office_redirect_booking(uuid,uuid,text) TO authenticated;

