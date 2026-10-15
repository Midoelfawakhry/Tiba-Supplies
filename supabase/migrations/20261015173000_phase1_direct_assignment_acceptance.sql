-- Phase 1 change 3: direct assignments are offers until the assigned driver accepts.
-- The acceptance state and timestamp are independent of notification delivery/read state.
-- Weight-only scope: no prices, monetary fields, or synthetic loading records are created here.

alter table public.bookings
  add column if not exists direct_acceptance_status text not null default 'NOT_REQUIRED',
  add column if not exists direct_accepted_at timestamptz,
  add column if not exists direct_accepted_by_driver_id uuid references public.drivers(driver_id) on delete restrict;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_direct_acceptance_status_check'
  ) then
    alter table public.bookings
      add constraint bookings_direct_acceptance_status_check
      check (direct_acceptance_status in ('NOT_REQUIRED','PENDING','ACCEPTED','LEGACY'));
  end if;
end;
$$;

-- Existing direct trips predate the explicit acceptance workflow. Preserve them as
-- legacy records without inventing an acceptance timestamp.
update public.bookings
set direct_acceptance_status = 'LEGACY'
where assignment_type = 'DIRECT'
  and direct_acceptance_status = 'NOT_REQUIRED';

create index if not exists bookings_pending_direct_acceptance_idx
  on public.bookings (driver_id, assigned_at desc)
  where assignment_type = 'DIRECT'
    and direct_acceptance_status = 'PENDING'
    and status = 'ASSIGNED';

create or replace function public.main_office_create_direct_trip(
  p_factory_id uuid,
  p_quarry_id uuid,
  p_driver_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_office_id uuid;
  v_factory public.factories%rowtype;
  v_quarry public.quarries%rowtype;
  v_driver public.drivers%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_vehicle_id uuid;
  v_order_id uuid;
  v_booking_id uuid;
  v_order_number bigint;
  v_trip_code text;
begin
  v_actor := public.current_main_office_user();

  if p_factory_id is null or p_quarry_id is null or p_driver_id is null then
    raise exception 'FACTORY_QUARRY_DRIVER_REQUIRED';
  end if;

  select office_id into v_office_id
  from public.offices
  where office_code = 'RAS_SEDR' and office_type = 'BRANCH' and is_active = true;
  if v_office_id is null then raise exception 'RAS_SEDR_BRANCH_CONFIGURATION_INVALID'; end if;

  select * into v_factory from public.factories where factory_id=p_factory_id and is_active=true for share;
  if not found then raise exception 'FACTORY_NOT_ACTIVE'; end if;
  select * into v_quarry from public.quarries where quarry_id=p_quarry_id and is_active=true for share;
  if not found then raise exception 'QUARRY_NOT_ACTIVE'; end if;

  select * into v_driver from public.drivers where driver_id=p_driver_id for update;
  if not found or not v_driver.is_active then raise exception 'DRIVER_NOT_ACTIVE'; end if;
  if v_driver.office_id <> v_office_id then raise exception 'DRIVER_OR_VEHICLE_NOT_ASSIGNED_TO_RAS_SEDR'; end if;

  select v.vehicle_id into v_vehicle_id
  from public.driver_vehicle_assignments a
  join public.vehicles v on v.vehicle_id=a.vehicle_id
  where a.driver_id=p_driver_id and a.ended_at is null
    and v.is_active=true and v.office_id=v_office_id
  for update of v;
  if v_vehicle_id is null then raise exception 'ACTIVE_LINKED_VEHICLE_REQUIRED'; end if;
  select * into v_vehicle from public.vehicles where vehicle_id=v_vehicle_id;

  if exists(select 1 from public.bookings where driver_id=p_driver_id and status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT')) then
    raise exception 'DRIVER_HAS_ACTIVE_BOOKING';
  end if;
  if exists(select 1 from public.bookings where vehicle_id=v_vehicle_id and status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT')) then
    raise exception 'VEHICLE_HAS_ACTIVE_BOOKING';
  end if;

  -- Atomic: one single-trip order and one booking, both roll back together on error.
  insert into public.load_orders(factory_id,quarry_id,created_by,requested_quantity,priority,notes,status)
  values(p_factory_id,p_quarry_id,v_actor,1,3,'إسناد مباشر — نقلة واحدة','DRAFT')
  returning load_order_id, order_number into v_order_id, v_order_number;

  v_trip_code := format('TIBA-%s', upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));
  insert into public.bookings(
    load_order_id,driver_id,vehicle_id,assigned_by,assignment_type,status,trip_code,direct_acceptance_status
  )
  values(v_order_id,p_driver_id,v_vehicle_id,v_actor,'DIRECT','ASSIGNED',v_trip_code,'PENDING')
  returning booking_id into v_booking_id;

  update public.load_orders set status='IN_PROGRESS',published_at=now(),updated_at=now()
  where load_order_id=v_order_id;

  insert into public.notifications(recipient_driver_id,notification_type,title,body,payload)
  values(p_driver_id,'DIRECT_ASSIGNMENT','إسناد تحميل مباشر',
    'تم إرسال تخصيص مباشر لك. افتح التطبيق واضغط تأكيد لقبول النقلة.',
    jsonb_build_object('booking_id',v_booking_id,'load_order_id',v_order_id,'trip_code',v_trip_code,
      'acceptance_required',true));

  perform public.write_audit_event('CREATE_DIRECT_TRIP','BOOKING',v_booking_id,
    jsonb_build_object('load_order_id',v_order_id,'order_number',v_order_number,
      'factory_id',p_factory_id,'quarry_id',p_quarry_id,'driver_id',p_driver_id,
      'vehicle_id',v_vehicle_id,'trip_code',v_trip_code,'direct_acceptance_status','PENDING'));

  return jsonb_build_object('booking_id',v_booking_id,'load_order_id',v_order_id,
    'order_number',v_order_number,'driver_id',p_driver_id,'vehicle_id',v_vehicle_id,
    'vehicle_code',v_vehicle.vehicle_code,'plate_number',v_vehicle.plate_number,
    'factory_id',p_factory_id,'factory_name',v_factory.name,'quarry_id',p_quarry_id,
    'quarry_name',v_quarry.name,'trip_code',v_trip_code,'status','ASSIGNED',
    'direct_acceptance_status','PENDING','accepted_at',null);
end;
$$;

create or replace function public.driver_get_pending_assignments()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_driver_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  select driver_id into v_driver_id
  from public.drivers
  where auth_user_id=auth.uid() and is_active=true;
  if v_driver_id is null then raise exception 'DRIVER_NOT_FOUND' using errcode='42501'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'booking_id',b.booking_id,
      'load_order_id',lo.load_order_id,
      'order_number',lo.order_number,
      'factory_id',f.factory_id,
      'factory_name',f.name,
      'quarry_id',q.quarry_id,
      'quarry_name',q.name,
      'trip_code',b.trip_code,
      'status',b.status,
      'acceptance_status',b.direct_acceptance_status,
      'assigned_at',b.assigned_at,
      'vehicle_id',v.vehicle_id,
      'vehicle_code',v.vehicle_code,
      'plate_number',v.plate_number
    ) order by b.assigned_at asc)
    from public.bookings b
    join public.load_orders lo on lo.load_order_id=b.load_order_id
    join public.factories f on f.factory_id=lo.factory_id
    join public.quarries q on q.quarry_id=lo.quarry_id
    join public.vehicles v on v.vehicle_id=b.vehicle_id
    where b.driver_id=v_driver_id
      and b.assignment_type='DIRECT'
      and b.status='ASSIGNED'
      and b.direct_acceptance_status='PENDING'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.accept_direct_assignment(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_driver_id uuid;
  v_booking public.bookings%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_booking_id is null then raise exception 'BOOKING_ID_REQUIRED'; end if;

  select driver_id into v_driver_id
  from public.drivers
  where auth_user_id=auth.uid() and is_active=true;
  if v_driver_id is null then raise exception 'DRIVER_NOT_FOUND' using errcode='42501'; end if;

  select * into v_booking
  from public.bookings
  where booking_id=p_booking_id
  for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_booking.driver_id <> v_driver_id then raise exception 'BOOKING_NOT_YOURS' using errcode='42501'; end if;
  if v_booking.assignment_type <> 'DIRECT' then raise exception 'NOT_A_DIRECT_ASSIGNMENT'; end if;

  if v_booking.direct_acceptance_status='ACCEPTED' then
    return jsonb_build_object('accepted',true,'already_accepted',true,
      'booking_id',v_booking.booking_id,'trip_code',v_booking.trip_code,
      'acceptance_status',v_booking.direct_acceptance_status,'accepted_at',v_booking.direct_accepted_at);
  end if;
  if v_booking.direct_acceptance_status <> 'PENDING' or v_booking.status <> 'ASSIGNED' then
    raise exception 'DIRECT_ASSIGNMENT_NOT_PENDING';
  end if;

  update public.bookings
  set direct_acceptance_status='ACCEPTED',
      direct_accepted_at=now(),
      direct_accepted_by_driver_id=v_driver_id,
      updated_at=now()
  where booking_id=p_booking_id
  returning * into v_booking;

  perform public.write_audit_event('ACCEPT_DIRECT_ASSIGNMENT','BOOKING',p_booking_id,
    jsonb_build_object('trip_code',v_booking.trip_code,'driver_id',v_driver_id,
      'acceptance_status',v_booking.direct_acceptance_status,'accepted_at',v_booking.direct_accepted_at));

  return jsonb_build_object('accepted',true,'already_accepted',false,
    'booking_id',v_booking.booking_id,'trip_code',v_booking.trip_code,
    'acceptance_status',v_booking.direct_acceptance_status,'accepted_at',v_booking.direct_accepted_at,
    'status',v_booking.status);
end;
$$;

-- A pending direct offer cannot advance into the operational loading lifecycle.
create or replace function public.main_office_advance_booking(
  p_booking_id uuid,
  p_next_status text,
  p_actual_weight numeric default null,
  p_ticket_number text default null,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_booking public.bookings%rowtype;
  v_next text := upper(trim(coalesce(p_next_status,'')));
begin
  v_actor := public.current_main_office_user();
  if p_booking_id is null then raise exception 'BOOKING_ID_REQUIRED'; end if;
  if v_next not in ('LOADING','LOADED','IN_TRANSIT','DELIVERED','CANCELLED') then
    raise exception 'INVALID_NEXT_BOOKING_STATUS';
  end if;

  select * into v_booking from public.bookings where booking_id=p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_booking.status in ('CANCELLED','DELIVERED') then raise exception 'BOOKING_TERMINAL_STATE'; end if;
  if v_booking.assignment_type='DIRECT' and v_booking.direct_acceptance_status='PENDING'
     and v_next <> 'CANCELLED' then
    raise exception 'DRIVER_ACCEPTANCE_REQUIRED';
  end if;
  if v_next='LOADING' and v_booking.status<>'ARRIVED' then raise exception 'ARRIVAL_REQUIRED_BEFORE_LOADING'; end if;
  if v_next='LOADED' then
    if v_booking.status<>'LOADING' then raise exception 'LOADING_STATE_REQUIRED'; end if;
    if p_actual_weight is null or p_actual_weight<=0 then raise exception 'POSITIVE_ACTUAL_WEIGHT_REQUIRED'; end if;
    insert into public.actual_loading_records(booking_id,actual_weight,ticket_number,recorded_by,notes)
    values(v_booking.booking_id,p_actual_weight,nullif(trim(p_ticket_number),''),v_actor,p_notes);
  end if;
  if v_next='IN_TRANSIT' and v_booking.status<>'LOADED' then raise exception 'LOADED_STATE_REQUIRED'; end if;
  if v_next='DELIVERED' then
    if v_booking.status<>'IN_TRANSIT' then raise exception 'IN_TRANSIT_STATE_REQUIRED'; end if;
    if not exists(select 1 from public.delivery_confirmations dc
      where dc.booking_id=p_booking_id and dc.confirmed_by_driver_id=v_booking.driver_id) then
      raise exception 'DRIVER_DELIVERY_CONFIRMATION_REQUIRED';
    end if;
  end if;
  if v_next='CANCELLED' then
    if nullif(trim(p_notes),'') is null then raise exception 'CANCELLATION_REASON_REQUIRED'; end if;
    if v_booking.status in ('LOADING','LOADED','IN_TRANSIT') then raise exception 'TRIP_PROGRESS_PREVENTS_CANCELLATION'; end if;
    update public.bookings set cancellation_reason=trim(p_notes),cancelled_at=now() where booking_id=p_booking_id;
  end if;

  update public.bookings set status=v_next,updated_at=now() where booking_id=p_booking_id;
  if v_next='DELIVERED' then
    update public.load_orders lo set status=case
      when not exists(select 1 from public.bookings b where b.load_order_id=lo.load_order_id
        and b.status not in ('DELIVERED','CANCELLED') and b.booking_id<>p_booking_id)
      then 'COMPLETED' else 'IN_PROGRESS' end,updated_at=now()
    where lo.load_order_id=v_booking.load_order_id;
  end if;
  if v_next='CANCELLED' then
    update public.load_orders lo set status=case
      when exists(select 1 from public.bookings b where b.load_order_id=lo.load_order_id
        and b.status not in ('DELIVERED','CANCELLED')) then 'IN_PROGRESS' else 'PUBLISHED' end,updated_at=now()
    where lo.load_order_id=v_booking.load_order_id and lo.status not in ('COMPLETED','CANCELLED');
  end if;

  perform public.write_audit_event('ADVANCE_BOOKING_'||v_next,'BOOKING',p_booking_id,
    jsonb_build_object('previous_status',v_booking.status,'next_status',v_next,
      'actual_weight',p_actual_weight,'ticket_number',p_ticket_number));
  return jsonb_build_object('booking_id',p_booking_id,'previous_status',v_booking.status,'status',v_next);
end;
$$;

-- Expose the acceptance state/time to the Main Office without conflating it with notifications.
create or replace function public.main_office_get_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_actor uuid;
begin
  v_actor:=public.current_main_office_user();
  return jsonb_build_object(
    'office',(select jsonb_build_object('office_id',office_id,'office_code',office_code,'name',name,'office_type',office_type,'latitude',latitude,'longitude',longitude,'geofence_radius_m',geofence_radius_m) from public.offices where office_code='MAIN' and office_type='HEAD_OFFICE' and is_active=true),
    'operational_office',(select jsonb_build_object('office_id',office_id,'office_code',office_code,'name',name,'office_type',office_type) from public.offices where office_code='MAIN' and office_type='HEAD_OFFICE' and is_active=true),
    'check_in_office',(select jsonb_build_object('office_id',office_id,'office_code',office_code,'name',name,'office_type',office_type,'latitude',latitude,'longitude',longitude,'geofence_radius_m',geofence_radius_m) from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true),
    'factories',(select coalesce(jsonb_agg(jsonb_build_object('factory_id',factory_id,'factory_code',factory_code,'name',name,'is_active',is_active) order by name),'[]'::jsonb) from public.factories),
    'quarries',(select coalesce(jsonb_agg(jsonb_build_object('quarry_id',quarry_id,'quarry_code',quarry_code,'name',name,'latitude',latitude,'longitude',longitude,'is_active',is_active) order by name),'[]'::jsonb) from public.quarries),
    'drivers',(select coalesce(jsonb_agg(jsonb_build_object('driver_id',d.driver_id,'driver_code',d.driver_code,'name',d.name,'phone',d.phone,'office_id',d.office_id,'is_active',d.is_active,'latitude',l.latitude,'longitude',l.longitude,'location_captured_at',l.captured_at,'location_received_at',l.received_at) order by d.name),'[]'::jsonb) from public.drivers d left join public.driver_live_locations l on l.driver_id=d.driver_id),
    'vehicles',(select coalesce(jsonb_agg(jsonb_build_object('vehicle_id',v.vehicle_id,'vehicle_code',v.vehicle_code,'plate_number',v.plate_number,'owner_id',v.owner_id,'office_id',v.office_id,'is_active',v.is_active) order by v.plate_number),'[]'::jsonb) from public.vehicles v),
    'load_orders',(select coalesce(jsonb_agg(jsonb_build_object('load_order_id',lo.load_order_id,'order_number',lo.order_number,'factory_id',lo.factory_id,'factory_name',f.name,'quarry_id',lo.quarry_id,'quarry_name',q.name,'requested_quantity',lo.requested_quantity,'priority',lo.priority,'status',lo.status,'created_at',lo.created_at,'published_at',lo.published_at,'notes',lo.notes) order by lo.created_at desc),'[]'::jsonb) from public.load_orders lo join public.factories f on f.factory_id=lo.factory_id join public.quarries q on q.quarry_id=lo.quarry_id),
    'bookings',(select coalesce(jsonb_agg(jsonb_build_object('booking_id',b.booking_id,'load_order_id',b.load_order_id,'driver_id',b.driver_id,'driver_name',d.name,'vehicle_id',b.vehicle_id,'plate_number',v.plate_number,'assignment_type',b.assignment_type,'status',b.status,'trip_code',b.trip_code,'assigned_at',b.assigned_at,'arrived_at',b.arrived_at,'direct_acceptance_status',b.direct_acceptance_status,'direct_accepted_at',b.direct_accepted_at) order by b.assigned_at desc),'[]'::jsonb) from public.bookings b join public.drivers d on d.driver_id=b.driver_id join public.vehicles v on v.vehicle_id=b.vehicle_id),
    'actual_loading_records',(select coalesce(jsonb_agg(jsonb_build_object('actual_load_id',a.actual_load_id,'booking_id',a.booking_id,'actual_weight',a.actual_weight,'ticket_number',a.ticket_number,'loaded_at',a.loaded_at,'notes',a.notes) order by a.loaded_at desc),'[]'::jsonb) from public.actual_loading_records a)
  );
end;
$$;

revoke all on function public.driver_get_pending_assignments() from public, anon;
grant execute on function public.driver_get_pending_assignments() to authenticated;
revoke all on function public.accept_direct_assignment(uuid) from public, anon;
grant execute on function public.accept_direct_assignment(uuid) to authenticated;
revoke all on function public.main_office_create_direct_trip(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.main_office_create_direct_trip(uuid,uuid,uuid) to authenticated;
revoke all on function public.main_office_advance_booking(uuid,text,numeric,text,text) from public, anon, authenticated;
grant execute on function public.main_office_advance_booking(uuid,text,numeric,text,text) to authenticated;

comment on column public.bookings.direct_acceptance_status is
  'Direct-assignment acceptance state, independent of notification delivery/read status.';
comment on column public.bookings.direct_accepted_at is
  'Timestamp when the assigned driver explicitly accepted a direct assignment; null until accepted.';
notify pgrst, 'reload schema';
