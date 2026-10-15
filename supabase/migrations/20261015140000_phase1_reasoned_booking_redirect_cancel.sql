-- Phase 1: Main Office can redirect or cancel an individual assigned trip.
-- Reasons are mandatory and audited. Redirect updates the existing booking, preserving
-- booking_id and trip_code; cancellation preserves the original booking as history.

create or replace function public.main_office_redirect_booking(
  p_booking_id uuid,
  p_new_load_order_id uuid,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_actor uuid;
  v_booking public.bookings%rowtype;
  v_new_order public.load_orders%rowtype;
  v_old_order public.load_orders%rowtype;
begin
  v_actor := public.current_main_office_user();
  if p_booking_id is null or p_new_load_order_id is null then raise exception 'BOOKING_AND_ORDER_REQUIRED'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'REDIRECT_REASON_REQUIRED'; end if;

  select * into v_booking from public.bookings where booking_id=p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_booking.status not in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT') then
    raise exception 'TRIP_NOT_REDIRECTABLE';
  end if;
  if exists(select 1 from public.delivery_confirmations dc where dc.booking_id=p_booking_id) then
    raise exception 'TRIP_ALREADY_CONFIRMED';
  end if;
  if v_booking.load_order_id=p_new_load_order_id then raise exception 'SAME_LOAD_ORDER'; end if;

  select * into v_new_order from public.load_orders
    where load_order_id=p_new_load_order_id and status in ('PUBLISHED','IN_PROGRESS')
    for update;
  if not found then raise exception 'NEW_LOAD_ORDER_NOT_AVAILABLE'; end if;
  select * into v_old_order from public.load_orders where load_order_id=v_booking.load_order_id for update;

  update public.bookings set load_order_id=p_new_load_order_id,updated_at=now()
    where booking_id=p_booking_id;

  insert into public.audit_log(actor_auth_user_id,actor_app_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),v_actor,'MAIN_OFFICE_REDIRECT_BOOKING','BOOKING',p_booking_id,
    jsonb_build_object(
      'trip_code',v_booking.trip_code,'previous_load_order_id',v_booking.load_order_id,
      'new_load_order_id',p_new_load_order_id,'previous_status',v_booking.status,
      'reason',trim(p_reason),'redirected_at',now()
    ));

  update public.load_orders lo set status=case
    when exists(select 1 from public.bookings b where b.load_order_id=lo.load_order_id and b.status not in ('DELIVERED','CANCELLED')) then 'IN_PROGRESS'
    else 'PUBLISHED' end,updated_at=now()
    where lo.load_order_id=v_old_order.load_order_id and lo.status not in ('COMPLETED','CANCELLED');

  update public.load_orders set status='IN_PROGRESS',updated_at=now()
    where load_order_id=p_new_load_order_id and status='PUBLISHED';

  return jsonb_build_object(
    'booking_id',p_booking_id,'trip_code',v_booking.trip_code,
    'previous_load_order_id',v_booking.load_order_id,'load_order_id',p_new_load_order_id,
    'status',v_booking.status,'reason',trim(p_reason)
  );
end; $$;

revoke all on function public.main_office_redirect_booking(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.main_office_redirect_booking(uuid,uuid,text) to authenticated;

create or replace function public.main_office_cancel_booking(
  p_booking_id uuid,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_actor uuid;
  v_booking public.bookings%rowtype;
begin
  v_actor := public.current_main_office_user();
  if p_booking_id is null then raise exception 'BOOKING_ID_REQUIRED'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'CANCELLATION_REASON_REQUIRED'; end if;

  select * into v_booking from public.bookings where booking_id=p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_booking.status in ('DELIVERED','CANCELLED') then raise exception 'TRIP_NOT_CANCELLABLE'; end if;
  if exists(select 1 from public.delivery_confirmations dc where dc.booking_id=p_booking_id) then
    raise exception 'TRIP_ALREADY_CONFIRMED';
  end if;

  update public.bookings set status='CANCELLED',cancelled_at=now(),
    cancellation_reason=trim(p_reason),updated_at=now()
    where booking_id=p_booking_id;

  update public.load_orders lo set status=case
    when exists(select 1 from public.bookings b where b.load_order_id=lo.load_order_id and b.status not in ('DELIVERED','CANCELLED')) then 'IN_PROGRESS'
    else 'PUBLISHED' end,updated_at=now()
    where lo.load_order_id=v_booking.load_order_id and lo.status not in ('COMPLETED','CANCELLED');

  insert into public.audit_log(actor_auth_user_id,actor_app_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),v_actor,'MAIN_OFFICE_CANCEL_BOOKING','BOOKING',p_booking_id,
    jsonb_build_object('trip_code',v_booking.trip_code,'load_order_id',v_booking.load_order_id,
      'previous_status',v_booking.status,'reason',trim(p_reason),'cancelled_at',now()));

  return jsonb_build_object('booking_id',p_booking_id,'trip_code',v_booking.trip_code,
    'previous_status',v_booking.status,'status','CANCELLED','reason',trim(p_reason));
end; $$;

revoke all on function public.main_office_cancel_booking(uuid,text) from public,anon,authenticated;
grant execute on function public.main_office_cancel_booking(uuid,text) to authenticated;

notify pgrst, 'reload schema';
