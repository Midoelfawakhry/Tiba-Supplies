-- Phase 1 Main Office read API and controlled booking lifecycle (Shadow only).
create or replace function public.main_office_get_directory()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_actor uuid;
begin
  v_actor := public.current_main_office_user();
  return jsonb_build_object(
    'factories', (select coalesce(jsonb_agg(jsonb_build_object('id', factory_id, 'code', factory_code, 'name', name, 'is_active', is_active) order by name), '[]'::jsonb) from public.factories),
    'quarries', (select coalesce(jsonb_agg(jsonb_build_object('id', quarry_id, 'code', quarry_code, 'name', name, 'is_active', is_active, 'latitude', latitude, 'longitude', longitude) order by name), '[]'::jsonb) from public.quarries),
    'owners', (select coalesce(jsonb_agg(jsonb_build_object('id', owner_id, 'code', owner_code, 'name', name, 'phone', phone, 'is_active', is_active) order by name), '[]'::jsonb) from public.vehicle_owners),
    'vehicles', (select coalesce(jsonb_agg(jsonb_build_object('id', vehicle_id, 'code', vehicle_code, 'plate_number', plate_number, 'owner_id', owner_id, 'office_id', office_id, 'is_active', is_active) order by plate_number), '[]'::jsonb) from public.vehicles),
    'drivers', (select coalesce(jsonb_agg(jsonb_build_object('id', driver_id, 'code', driver_code, 'name', name, 'phone', phone, 'office_id', office_id, 'is_active', is_active) order by name), '[]'::jsonb) from public.drivers)
  );
end;
$$;
revoke all on function public.main_office_get_directory() from public, anon, authenticated;
grant execute on function public.main_office_get_directory() to authenticated;

create or replace function public.main_office_advance_booking(p_booking_id uuid, p_next_status text, p_actual_weight numeric default null, p_ticket_number text default null, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_booking public.bookings%rowtype;
  v_next text := upper(trim(coalesce(p_next_status, '')));
begin
  v_actor := public.current_main_office_user();
  if p_booking_id is null then raise exception 'BOOKING_ID_REQUIRED'; end if;
  if v_next not in ('LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED') then raise exception 'INVALID_NEXT_BOOKING_STATUS'; end if;
  select * into v_booking from public.bookings where booking_id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_booking.status in ('CANCELLED', 'DELIVERED') then raise exception 'BOOKING_TERMINAL_STATE'; end if;
  if v_next = 'LOADING' and v_booking.status <> 'ARRIVED' then raise exception 'ARRIVAL_REQUIRED_BEFORE_LOADING'; end if;
  if v_next = 'LOADED' then
    if v_booking.status <> 'LOADING' then raise exception 'LOADING_STATE_REQUIRED'; end if;
    if p_actual_weight is null or p_actual_weight <= 0 then raise exception 'POSITIVE_ACTUAL_WEIGHT_REQUIRED'; end if;
    insert into public.actual_loading_records(booking_id, actual_weight, ticket_number, recorded_by, notes)
    values (v_booking.booking_id, p_actual_weight, nullif(trim(p_ticket_number), ''), v_actor, p_notes);
  end if;
  if v_next = 'IN_TRANSIT' and v_booking.status <> 'LOADED' then raise exception 'LOADED_STATE_REQUIRED'; end if;
  if v_next = 'DELIVERED' and v_booking.status <> 'IN_TRANSIT' then raise exception 'IN_TRANSIT_STATE_REQUIRED'; end if;
  if v_next = 'CANCELLED' then
    if nullif(trim(p_notes), '') is null then raise exception 'CANCELLATION_REASON_REQUIRED'; end if;
    if v_booking.status in ('LOADING', 'LOADED', 'IN_TRANSIT') then raise exception 'TRIP_PROGRESS_PREVENTS_CANCELLATION'; end if;
    update public.bookings set cancellation_reason = trim(p_notes), cancelled_at = now() where booking_id = p_booking_id;
  end if;
  update public.bookings set status = v_next, updated_at = now() where booking_id = p_booking_id;
  if v_next = 'DELIVERED' then
    update public.load_orders lo set status = case
      when not exists(select 1 from public.bookings b where b.load_order_id = lo.load_order_id and b.status not in ('DELIVERED','CANCELLED') and b.booking_id <> p_booking_id) then 'COMPLETED'
      else 'IN_PROGRESS' end,
      updated_at = now()
    where lo.load_order_id = v_booking.load_order_id;
  end if;
  perform public.write_audit_event('ADVANCE_BOOKING_' || v_next, 'BOOKING', p_booking_id,
    jsonb_build_object('previous_status', v_booking.status, 'next_status', v_next, 'actual_weight', p_actual_weight, 'ticket_number', p_ticket_number));
  return jsonb_build_object('booking_id', p_booking_id, 'previous_status', v_booking.status, 'status', v_next);
end;
$$;
revoke all on function public.main_office_advance_booking(uuid, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.main_office_advance_booking(uuid, text, numeric, text, text) to authenticated;
