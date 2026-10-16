-- Phase 1 / Change 4: ordinary queue, five-minute selection window, and atomic fair allocation.
-- Deliberately separate from DIRECT assignment acceptance. Driver location/tracking services remain unchanged.

create table if not exists public.dispatch_windows (
  dispatch_window_id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(office_id) on delete restrict,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED','CANCELLED')),
  opened_at timestamptz not null default now(),
  selection_ends_at timestamptz not null,
  closed_at timestamptz,
  created_by uuid references public.app_users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  check (selection_ends_at > opened_at)
);

create unique index if not exists dispatch_windows_one_open_per_office
  on public.dispatch_windows(office_id) where status='OPEN';

alter table public.load_orders
  add column if not exists dispatch_window_id uuid references public.dispatch_windows(dispatch_window_id) on delete restrict;

create table if not exists public.waiting_list_entries (
  entry_id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(driver_id) on delete restrict,
  office_id uuid not null references public.offices(office_id) on delete restrict,
  arrived_at timestamptz not null default now(),
  last_check_in_at timestamptz not null default now(),
  status text not null default 'WAITING' check (status in ('WAITING','ASSIGNED','LEFT','EXPIRED')),
  assigned_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists waiting_list_one_active_entry_per_driver_office
  on public.waiting_list_entries(driver_id,office_id) where status='WAITING';
create index if not exists waiting_list_fair_order_idx
  on public.waiting_list_entries(office_id,status,arrived_at,entry_id);

create table if not exists public.driver_load_choices (
  choice_id uuid primary key default gen_random_uuid(),
  dispatch_window_id uuid not null references public.dispatch_windows(dispatch_window_id) on delete restrict,
  driver_id uuid not null references public.drivers(driver_id) on delete restrict,
  queue_entry_id uuid not null references public.waiting_list_entries(entry_id) on delete restrict,
  load_order_id uuid not null references public.load_orders(load_order_id) on delete restrict,
  chosen_at timestamptz not null default now(),
  status text not null default 'CHOSEN' check (status in ('CHOSEN','ALLOCATED','NOT_ALLOCATED','WITHDRAWN')),
  assigned_booking_id uuid references public.bookings(booking_id) on delete restrict,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(dispatch_window_id,driver_id)
);

create index if not exists driver_load_choices_window_fair_idx
  on public.driver_load_choices(dispatch_window_id,status,chosen_at);
create index if not exists load_orders_dispatch_window_idx
  on public.load_orders(dispatch_window_id,status);

alter table public.dispatch_windows enable row level security;
alter table public.waiting_list_entries enable row level security;
alter table public.driver_load_choices enable row level security;
revoke all on public.dispatch_windows, public.waiting_list_entries, public.driver_load_choices from anon, authenticated;

create or replace function public.driver_check_in_queue(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision,
  p_captured_at timestamptz
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public
as $$
declare
  v_driver public.drivers%rowtype;
  v_office public.offices%rowtype;
  v_location public.driver_live_locations%rowtype;
  v_distance_m double precision;
  v_entry public.waiting_list_entries%rowtype;
  v_position integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_latitude is null or p_latitude not between -90 and 90 or p_longitude is null or p_longitude not between -180 and 180 then raise exception 'INVALID_COORDINATES'; end if;
  if p_accuracy_m is null or p_accuracy_m < 0 or p_accuracy_m > 100 then raise exception 'LOCATION_ACCURACY_TOO_LOW'; end if;
  if p_captured_at is null or p_captured_at < now()-interval '10 minutes' or p_captured_at > now()+interval '1 minute' then raise exception 'LOCATION_TIMESTAMP_STALE_OR_INVALID'; end if;

  select * into v_driver from public.drivers where auth_user_id=auth.uid() and is_active=true for update;
  if not found then raise exception 'ACTIVE_DRIVER_ACCOUNT_REQUIRED'; end if;
  if exists(select 1 from public.bookings b where b.driver_id=v_driver.driver_id and b.status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT')) then
    raise exception 'DRIVER_HAS_ACTIVE_BOOKING';
  end if;

  select * into v_office from public.offices
  where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true;
  if not found or v_office.latitude is null or v_office.longitude is null then raise exception 'RAS_SEDR_GEOFENCE_NOT_CONFIGURED'; end if;

  v_distance_m:=6371000*2*asin(sqrt(least(1,greatest(0,
    power(sin(radians(p_latitude-v_office.latitude)/2),2)
    +cos(radians(v_office.latitude))*cos(radians(p_latitude))*power(sin(radians(p_longitude-v_office.longitude)/2),2)
  ))));
  if v_distance_m > coalesce(v_office.geofence_radius_m,10000) then raise exception 'OUTSIDE_RAS_SEDR_GEOFENCE'; end if;

  select * into v_location from public.driver_live_locations where driver_id=v_driver.driver_id for update;
  if not found or v_location.captured_at <= p_captured_at then
    insert into public.driver_live_locations(driver_id,latitude,longitude,accuracy_m,captured_at,received_at)
    values(v_driver.driver_id,p_latitude,p_longitude,p_accuracy_m,p_captured_at,now())
    on conflict(driver_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,
      accuracy_m=excluded.accuracy_m,captured_at=excluded.captured_at,received_at=now()
    where public.driver_live_locations.captured_at <= excluded.captured_at;
  end if;

  select * into v_entry from public.waiting_list_entries
  where driver_id=v_driver.driver_id and office_id=v_office.office_id and status='WAITING'
  order by arrived_at desc limit 1 for update;
  if found then
    update public.waiting_list_entries set last_check_in_at=now(),updated_at=now()
    where entry_id=v_entry.entry_id returning * into v_entry;
  else
    insert into public.waiting_list_entries(driver_id,office_id,status)
    values(v_driver.driver_id,v_office.office_id,'WAITING')
    returning * into v_entry;
  end if;

  select count(*)::integer+1 into v_position from public.waiting_list_entries w
  where w.office_id=v_office.office_id and w.status='WAITING'
    and (w.arrived_at < v_entry.arrived_at or (w.arrived_at=v_entry.arrived_at and w.entry_id<v_entry.entry_id));

  insert into public.audit_log(actor_auth_user_id,actor_app_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),null,'DRIVER_QUEUE_CHECK_IN','WAITING_LIST_ENTRY',v_entry.entry_id,
    jsonb_build_object('driver_id',v_driver.driver_id,'office_id',v_office.office_id,'distance_m',round(v_distance_m::numeric,1),
      'accuracy_m',p_accuracy_m,'captured_at',p_captured_at,'arrived_at',v_entry.arrived_at));

  return jsonb_build_object('entry_id',v_entry.entry_id,'queue_status',v_entry.status,'queue_position',v_position,
    'arrived_at',v_entry.arrived_at,'distance_m',round(v_distance_m::numeric,1),'radius_m',v_office.geofence_radius_m);
end;
$$;

create or replace function public.driver_select_load(
  p_load_order_id uuid
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public
as $$
declare
  v_driver public.drivers%rowtype;
  v_office public.offices%rowtype;
  v_location public.driver_live_locations%rowtype;
  v_entry public.waiting_list_entries%rowtype;
  v_order public.load_orders%rowtype;
  v_window public.dispatch_windows%rowtype;
  v_vehicle_id uuid;
  v_distance_m double precision;
  v_choice public.driver_load_choices%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select * into v_driver from public.drivers where auth_user_id=auth.uid() and is_active=true for update;
  if not found then raise exception 'ACTIVE_DRIVER_ACCOUNT_REQUIRED'; end if;

  select * into v_office from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true;
  if not found or v_office.latitude is null or v_office.longitude is null then raise exception 'RAS_SEDR_GEOFENCE_NOT_CONFIGURED'; end if;

  select * into v_entry from public.waiting_list_entries
  where driver_id=v_driver.driver_id and office_id=v_office.office_id and status='WAITING'
  order by arrived_at desc limit 1 for update;
  if not found then raise exception 'DRIVER_NOT_IN_WAITING_QUEUE'; end if;

  select * into v_location from public.driver_live_locations where driver_id=v_driver.driver_id;
  if not found or v_location.captured_at < now()-interval '10 minutes' or v_location.captured_at > now()+interval '1 minute'
     or v_location.accuracy_m is null or v_location.accuracy_m>100 then raise exception 'LOCATION_STALE_OR_INACCURATE'; end if;
  v_distance_m:=6371000*2*asin(sqrt(least(1,greatest(0,
    power(sin(radians(v_location.latitude-v_office.latitude)/2),2)
    +cos(radians(v_office.latitude))*cos(radians(v_location.latitude))*power(sin(radians(v_location.longitude-v_office.longitude)/2),2)
  ))));
  if v_distance_m>coalesce(v_office.geofence_radius_m,10000) then raise exception 'OUTSIDE_RAS_SEDR_GEOFENCE'; end if;

  if exists(select 1 from public.bookings b where b.driver_id=v_driver.driver_id and b.status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT')) then
    raise exception 'DRIVER_HAS_ACTIVE_BOOKING';
  end if;
  select v.vehicle_id into v_vehicle_id from public.driver_vehicle_assignments a
  join public.vehicles v on v.vehicle_id=a.vehicle_id
  where a.driver_id=v_driver.driver_id and a.ended_at is null and v.is_active=true and v.office_id=v_office.office_id
  order by a.created_at desc nulls last limit 1;
  if v_vehicle_id is null then raise exception 'ACTIVE_LINKED_VEHICLE_REQUIRED'; end if;
  if exists(select 1 from public.bookings b where b.vehicle_id=v_vehicle_id and b.status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT')) then
    raise exception 'VEHICLE_HAS_ACTIVE_BOOKING';
  end if;

  select * into v_order from public.load_orders where load_order_id=p_load_order_id for update;
  if not found or v_order.status not in ('PUBLISHED','IN_PROGRESS') then raise exception 'LOAD_ORDER_NOT_AVAILABLE'; end if;
  if v_order.dispatch_window_id is null then raise exception 'LOAD_ORDER_HAS_NO_SELECTION_WINDOW'; end if;
  select * into v_window from public.dispatch_windows where dispatch_window_id=v_order.dispatch_window_id for update;
  if not found or v_window.status<>'OPEN' or now()>=v_window.selection_ends_at then raise exception 'SELECTION_WINDOW_CLOSED'; end if;
  if v_window.office_id<>v_office.office_id then raise exception 'LOAD_ORDER_WRONG_OFFICE'; end if;
  if (select count(*) from public.bookings b where b.load_order_id=v_order.load_order_id and b.status<>'CANCELLED')>=v_order.requested_quantity then
    raise exception 'LOAD_ORDER_FULL';
  end if;

  insert into public.driver_load_choices(dispatch_window_id,driver_id,queue_entry_id,load_order_id,status)
  values(v_window.dispatch_window_id,v_driver.driver_id,v_entry.entry_id,v_order.load_order_id,'CHOSEN')
  on conflict(dispatch_window_id,driver_id) do update
    set queue_entry_id=excluded.queue_entry_id,load_order_id=excluded.load_order_id,
        chosen_at=now(),status='CHOSEN',assigned_booking_id=null,finalized_at=null,updated_at=now()
  where public.driver_load_choices.status='CHOSEN'
  returning * into v_choice;
  if not found then raise exception 'DRIVER_CHOICE_ALREADY_FINALIZED'; end if;

  insert into public.audit_log(actor_auth_user_id,actor_app_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),null,'DRIVER_SELECT_LOAD','DRIVER_LOAD_CHOICE',v_choice.choice_id,
    jsonb_build_object('driver_id',v_driver.driver_id,'load_order_id',v_order.load_order_id,
      'dispatch_window_id',v_window.dispatch_window_id,'chosen_at',v_choice.chosen_at));

  return jsonb_build_object('choice_id',v_choice.choice_id,'load_order_id',v_choice.load_order_id,
    'chosen_at',v_choice.chosen_at,'selection_ends_at',v_window.selection_ends_at,'status',v_choice.status);
end;
$$;

create or replace function public.finalize_expired_dispatch_windows()
returns integer
language plpgsql security definer
set search_path=pg_catalog,public
as $$
declare
  v_window public.dispatch_windows%rowtype;
  v_choice public.driver_load_choices%rowtype;
  v_entry public.waiting_list_entries%rowtype;
  v_driver public.drivers%rowtype;
  v_order public.load_orders%rowtype;
  v_office public.offices%rowtype;
  v_location public.driver_live_locations%rowtype;
  v_vehicle_id uuid;
  v_booking_id uuid;
  v_trip_code text;
  v_distance_m double precision;
  v_allocated integer:=0;
begin
  for v_window in
    select * from public.dispatch_windows
    where status='OPEN' and selection_ends_at<=now()
    order by selection_ends_at,opened_at
    for update skip locked
  loop
    select * into v_office from public.offices where office_id=v_window.office_id;
    if not found then
      update public.dispatch_windows set status='CANCELLED',closed_at=now() where dispatch_window_id=v_window.dispatch_window_id;
      continue;
    end if;

    for v_choice in
      select c.* from public.driver_load_choices c
      join public.waiting_list_entries w on w.entry_id=c.queue_entry_id
      where c.dispatch_window_id=v_window.dispatch_window_id and c.status='CHOSEN'
      order by w.arrived_at asc,w.entry_id asc,c.chosen_at asc,c.choice_id asc
      for update of c
    loop
      select * into v_entry from public.waiting_list_entries
      where entry_id=v_choice.queue_entry_id for update;
      select * into v_driver from public.drivers where driver_id=v_choice.driver_id and is_active=true for update;
      if not found or v_entry.status<>'WAITING' then
        update public.driver_load_choices set status='NOT_ALLOCATED',finalized_at=now(),updated_at=now()
        where choice_id=v_choice.choice_id;
        continue;
      end if;

      select * into v_location from public.driver_live_locations where driver_id=v_driver.driver_id;
      if not found or v_location.captured_at<now()-interval '10 minutes'
        or v_location.captured_at>now()+interval '1 minute'
        or v_location.accuracy_m is null or v_location.accuracy_m>100 then
        update public.driver_load_choices set status='NOT_ALLOCATED',finalized_at=now(),updated_at=now()
        where choice_id=v_choice.choice_id;
        continue;
      end if;
      v_distance_m:=6371000*2*asin(sqrt(least(1,greatest(0,
        power(sin(radians(v_location.latitude-v_office.latitude)/2),2)
        +cos(radians(v_office.latitude))*cos(radians(v_location.latitude))*power(sin(radians(v_location.longitude-v_office.longitude)/2),2)
      ))));
      if v_distance_m>coalesce(v_office.geofence_radius_m,10000) then
        update public.driver_load_choices set status='NOT_ALLOCATED',finalized_at=now(),updated_at=now()
        where choice_id=v_choice.choice_id;
        continue;
      end if;

      select v.vehicle_id into v_vehicle_id from public.driver_vehicle_assignments a
      join public.vehicles v on v.vehicle_id=a.vehicle_id
      where a.driver_id=v_driver.driver_id and a.ended_at is null
        and v.is_active=true and v.office_id=v_office.office_id
      order by a.created_at desc nulls last limit 1 for update of v;
      if v_vehicle_id is null
        or exists(select 1 from public.bookings b where b.driver_id=v_driver.driver_id and b.status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT'))
        or exists(select 1 from public.bookings b where b.vehicle_id=v_vehicle_id and b.status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT')) then
        update public.driver_load_choices set status='NOT_ALLOCATED',finalized_at=now(),updated_at=now()
        where choice_id=v_choice.choice_id;
        continue;
      end if;

      select * into v_order from public.load_orders where load_order_id=v_choice.load_order_id for update;
      if not found or v_order.dispatch_window_id<>v_window.dispatch_window_id
        or v_order.status not in ('PUBLISHED','IN_PROGRESS')
        or (select count(*) from public.bookings b where b.load_order_id=v_order.load_order_id and b.status<>'CANCELLED')>=v_order.requested_quantity then
        update public.driver_load_choices set status='NOT_ALLOCATED',finalized_at=now(),updated_at=now()
        where choice_id=v_choice.choice_id;
        continue;
      end if;

      v_trip_code:=format('TIBA-%s',upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));
      insert into public.bookings(load_order_id,driver_id,vehicle_id,assigned_by,assignment_type,status,trip_code,direct_acceptance_status)
      values(v_order.load_order_id,v_driver.driver_id,v_vehicle_id,
        coalesce((select user_id from public.app_users where auth_user_id is null and role in ('ADMIN','HEAD_OFFICE') and is_active=true order by created_at limit 1),
                 v_order.created_by),
        'QUEUE','ASSIGNED',v_trip_code,'NOT_REQUIRED')
      returning booking_id into v_booking_id;

      update public.driver_load_choices set status='ALLOCATED',assigned_booking_id=v_booking_id,finalized_at=now(),updated_at=now()
      where choice_id=v_choice.choice_id;
      update public.waiting_list_entries set status='ASSIGNED',assigned_at=now(),updated_at=now()
      where entry_id=v_entry.entry_id;
      update public.load_orders set status='IN_PROGRESS',updated_at=now() where load_order_id=v_order.load_order_id and status='PUBLISHED';

      insert into public.notifications(recipient_driver_id,notification_type,title,body,payload)
      values(v_driver.driver_id,'LOAD_REQUEST_ACCEPTED','تم قبول طلب التحميل',
        'تم قبول اختيارك وتخصيص النقلة لك. راجع تفاصيل النقلة في التطبيق.',
        jsonb_build_object('booking_id',v_booking_id,'load_order_id',v_order.load_order_id,
          'trip_code',v_trip_code,'dispatch_window_id',v_window.dispatch_window_id));

      insert into public.audit_log(actor_auth_user_id,actor_app_user_id,action,entity_type,entity_id,details)
      values(null,null,'QUEUE_LOAD_ALLOCATED','BOOKING',v_booking_id,
        jsonb_build_object('driver_id',v_driver.driver_id,'queue_entry_id',v_entry.entry_id,
          'choice_id',v_choice.choice_id,'load_order_id',v_order.load_order_id,
          'dispatch_window_id',v_window.dispatch_window_id,'trip_code',v_trip_code,
          'queue_arrived_at',v_entry.arrived_at,'chosen_at',v_choice.chosen_at));
      v_allocated:=v_allocated+1;
    end loop;

    update public.driver_load_choices set status='NOT_ALLOCATED',finalized_at=now(),updated_at=now()
    where dispatch_window_id=v_window.dispatch_window_id and status='CHOSEN';
    update public.waiting_list_entries w set status='LEFT',left_at=now(),updated_at=now()
    where w.office_id=v_window.office_id and w.status='WAITING'
      and exists(select 1 from public.driver_load_choices c where c.dispatch_window_id=v_window.dispatch_window_id and c.queue_entry_id=w.entry_id);
    update public.dispatch_windows set status='CLOSED',closed_at=now()
    where dispatch_window_id=v_window.dispatch_window_id;
  end loop;
  return v_allocated;
end;
$$;

create or replace function public.driver_get_dispatch_state()
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public
as $$
declare
  v_driver public.drivers%rowtype;
  v_office public.offices%rowtype;
  v_location public.driver_live_locations%rowtype;
  v_entry public.waiting_list_entries%rowtype;
  v_window public.dispatch_windows%rowtype;
  v_choice public.driver_load_choices%rowtype;
  v_distance_m double precision;
  v_inside boolean:=false;
  v_position integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select * into v_driver from public.drivers where auth_user_id=auth.uid() and is_active=true;
  if not found then raise exception 'DRIVER_NOT_FOUND' using errcode='42501'; end if;
  select * into v_office from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true;
  if not found or v_office.latitude is null or v_office.longitude is null then raise exception 'RAS_SEDR_GEOFENCE_NOT_CONFIGURED'; end if;
  select * into v_location from public.driver_live_locations where driver_id=v_driver.driver_id;
  if found and v_location.captured_at>=now()-interval '10 minutes' and v_location.captured_at<=now()+interval '1 minute'
    and v_location.accuracy_m is not null and v_location.accuracy_m<=100 then
    v_distance_m:=6371000*2*asin(sqrt(least(1,greatest(0,
      power(sin(radians(v_location.latitude-v_office.latitude)/2),2)
      +cos(radians(v_office.latitude))*cos(radians(v_location.latitude))*power(sin(radians(v_location.longitude-v_office.longitude)/2),2)
    ))));
    v_inside:=v_distance_m<=coalesce(v_office.geofence_radius_m,10000);
  end if;
  select * into v_entry from public.waiting_list_entries
  where driver_id=v_driver.driver_id and office_id=v_office.office_id and status='WAITING'
  order by arrived_at desc limit 1;
  if found then
    select count(*)::integer+1 into v_position from public.waiting_list_entries w
    where w.office_id=v_office.office_id and w.status='WAITING'
      and (w.arrived_at<v_entry.arrived_at or (w.arrived_at=v_entry.arrived_at and w.entry_id<v_entry.entry_id));
  end if;
  select * into v_window from public.dispatch_windows where office_id=v_office.office_id
  order by opened_at desc limit 1;
  select * into v_choice from public.driver_load_choices c
  where c.driver_id=v_driver.driver_id and c.dispatch_window_id=v_window.dispatch_window_id
  order by c.chosen_at desc limit 1;

  return jsonb_build_object(
    'inside_geofence',v_inside,'distance_m',v_distance_m,'radius_m',coalesce(v_office.geofence_radius_m,10000),
    'location_updated_at',v_location.captured_at,'office_name',v_office.name,
    'queue_status',case when not v_inside then 'OUTSIDE' when v_entry.entry_id is not null then 'WAITING'
      when exists(select 1 from public.waiting_list_entries w where w.driver_id=v_driver.driver_id and w.office_id=v_office.office_id and w.status='ASSIGNED' and w.assigned_at>now()-interval '1 day') then 'ASSIGNED'
      else 'NOT_REGISTERED' end,
    'queue_position',v_position,'queue_arrived_at',v_entry.arrived_at,
    'selection_window',case when v_window.dispatch_window_id is null then null else jsonb_build_object(
      'dispatch_window_id',v_window.dispatch_window_id,'status',v_window.status,'opened_at',v_window.opened_at,
      'selection_ends_at',v_window.selection_ends_at,'closed_at',v_window.closed_at,
      'is_open',v_window.status='OPEN' and now()<v_window.selection_ends_at) end,
    'selected_load_order_id',v_choice.load_order_id,'choice_status',v_choice.status,'chosen_at',v_choice.chosen_at,
    'available_loads',case when v_inside and v_entry.entry_id is not null and v_window.status='OPEN' and now()<v_window.selection_ends_at
      then coalesce((select jsonb_agg(jsonb_build_object(
        'load_order_id',lo.load_order_id,'order_number',lo.order_number,'factory_name',f.name,'quarry_name',q.name,
        'factory_id',f.factory_id,'quarry_id',q.quarry_id,'requested_quantity',lo.requested_quantity,
        'committed_quantity',(select count(*) from public.bookings b where b.load_order_id=lo.load_order_id and b.status<>'CANCELLED'),
        'remaining_quantity',greatest(0,lo.requested_quantity-(select count(*) from public.bookings b where b.load_order_id=lo.load_order_id and b.status<>'CANCELLED')),
        'priority',lo.priority,'status',lo.status,'selection_ends_at',v_window.selection_ends_at,
        'is_selected',v_choice.load_order_id=lo.load_order_id and v_choice.status='CHOSEN')
        order by lo.priority asc,lo.created_at asc)
        from public.load_orders lo join public.factories f on f.factory_id=lo.factory_id
        join public.quarries q on q.quarry_id=lo.quarry_id
        where lo.dispatch_window_id=v_window.dispatch_window_id and lo.status in ('PUBLISHED','IN_PROGRESS')
          and (select count(*) from public.bookings b where b.load_order_id=lo.load_order_id and b.status<>'CANCELLED')<lo.requested_quantity
      ),'[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

create or replace function public.get_office_waiting_list()
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public
as $$
declare v_uid uuid:=auth.uid(); v_role text; v_office public.offices%rowtype; v_window public.dispatch_windows%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select role into v_role from public.app_users where auth_user_id=v_uid and is_active=true limit 1;
  if v_role is null or v_role not in ('ADMIN','HEAD_OFFICE','BRANCH') then raise exception 'INSUFFICIENT_ROLE'; end if;
  select * into v_office from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true;
  select * into v_window from public.dispatch_windows where office_id=v_office.office_id order by opened_at desc limit 1;
  return jsonb_build_object(
    'office_id',v_office.office_id,
    'selection_window',case when v_window.dispatch_window_id is null then null else jsonb_build_object(
      'dispatch_window_id',v_window.dispatch_window_id,'status',v_window.status,'opened_at',v_window.opened_at,
      'selection_ends_at',v_window.selection_ends_at,'closed_at',v_window.closed_at) end,
    'entries',coalesce((select jsonb_agg(jsonb_build_object(
      'entry_id',w.entry_id,'driver_id',w.driver_id,'driver_name',d.name,'driver_code',d.driver_code,
      'arrived_at',w.arrived_at,'status',w.status,'queue_position',x.position,'last_check_in_at',w.last_check_in_at,
      'selected_load_order_id',c.load_order_id,'choice_status',c.status,'chosen_at',c.chosen_at,
      'trip_code',b.trip_code,'booking_id',b.booking_id)
      order by w.arrived_at,w.entry_id)
      from public.waiting_list_entries w join public.drivers d on d.driver_id=w.driver_id
      left join lateral (select count(*)::integer+1 position from public.waiting_list_entries p
        where p.office_id=w.office_id and p.status='WAITING'
          and (p.arrived_at<w.arrived_at or (p.arrived_at=w.arrived_at and p.entry_id<w.entry_id))) x on true
      left join public.driver_load_choices c on c.queue_entry_id=w.entry_id and c.dispatch_window_id=v_window.dispatch_window_id
      left join public.bookings b on b.booking_id=c.assigned_booking_id
      where w.office_id=v_office.office_id and w.status in ('WAITING','ASSIGNED')
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.main_office_publish_load_order(p_load_order_id uuid)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public
as $$
declare
  v_actor uuid;
  v_order public.load_orders%rowtype;
  v_office public.offices%rowtype;
  v_window public.dispatch_windows%rowtype;
  v_window_id uuid;
  v_ends_at timestamptz;
  v_notified integer:=0;
begin
  v_actor:=public.current_main_office_user();
  perform public.finalize_expired_dispatch_windows();
  select * into v_order from public.load_orders where load_order_id=p_load_order_id for update;
  if not found then raise exception 'LOAD_ORDER_NOT_FOUND'; end if;
  if v_order.status<>'DRAFT' then raise exception 'LOAD_ORDER_NOT_DRAFT'; end if;
  select * into v_office from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true;
  if not found then raise exception 'RAS_SEDR_BRANCH_CONFIGURATION_INVALID'; end if;

  select * into v_window from public.dispatch_windows
  where office_id=v_office.office_id and status='OPEN' and selection_ends_at>now()
  order by opened_at desc limit 1 for update;
  if not found then
    insert into public.dispatch_windows(office_id,status,opened_at,selection_ends_at,created_by)
    values(v_office.office_id,'OPEN',now(),now()+interval '5 minutes',v_actor)
    returning * into v_window;
  end if;
  v_window_id:=v_window.dispatch_window_id;
  v_ends_at:=v_window.selection_ends_at;

  update public.load_orders set status='PUBLISHED',published_at=now(),dispatch_window_id=v_window_id,updated_at=now()
  where load_order_id=p_load_order_id;

  insert into public.notifications(recipient_driver_id,notification_type,title,body,payload)
  select d.driver_id,'LOAD_SELECTION_OPEN','طلب تحميل متاح للاختيار',
    'تم نشر طلب تحميل. اختار النقلة خلال نافذة الاختيار المحددة بخمس دقائق.',
    jsonb_build_object('load_order_id',p_load_order_id,'dispatch_window_id',v_window_id,
      'selection_ends_at',v_ends_at,'factory_id',v_order.factory_id,'quarry_id',v_order.quarry_id)
  from public.drivers d
  join public.driver_live_locations l on l.driver_id=d.driver_id
  where d.is_active=true and d.office_id=v_office.office_id
    and l.captured_at>=now()-interval '10 minutes' and l.captured_at<=now()+interval '1 minute'
    and l.accuracy_m is not null and l.accuracy_m<=100
    and 6371000*2*asin(sqrt(least(1,greatest(0,
      power(sin(radians(l.latitude-v_office.latitude)/2),2)
      +cos(radians(v_office.latitude))*cos(radians(l.latitude))*power(sin(radians(l.longitude-v_office.longitude)/2),2)
    )))) <= coalesce(v_office.geofence_radius_m,10000)
    and exists(select 1 from public.waiting_list_entries w where w.driver_id=d.driver_id
      and w.office_id=v_office.office_id and w.status='WAITING')
    and exists(select 1 from public.driver_vehicle_assignments a join public.vehicles v on v.vehicle_id=a.vehicle_id
      where a.driver_id=d.driver_id and a.ended_at is null and v.is_active=true and v.office_id=v_office.office_id)
    and not exists(select 1 from public.bookings b where b.driver_id=d.driver_id and b.status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT'));
  get diagnostics v_notified=row_count;

  perform public.write_audit_event('PUBLISH_LOAD_ORDER','LOAD_ORDER',p_load_order_id,
    jsonb_build_object('dispatch_window_id',v_window_id,'selection_ends_at',v_ends_at,'eligible_drivers_notified',v_notified));
  return jsonb_build_object('load_order_id',p_load_order_id,'status','PUBLISHED',
    'dispatch_window_id',v_window_id,'selection_ends_at',v_ends_at,'selection_window_seconds',300,
    'eligible_drivers_notified',v_notified);
end;
$$;

revoke all on function public.driver_check_in_queue(double precision,double precision,double precision,timestamptz) from public,anon;
grant execute on function public.driver_check_in_queue(double precision,double precision,double precision,timestamptz) to authenticated;
revoke all on function public.driver_select_load(uuid) from public,anon;
grant execute on function public.driver_select_load(uuid) to authenticated;
revoke all on function public.driver_get_dispatch_state() from public,anon;
grant execute on function public.driver_get_dispatch_state() to authenticated;
revoke all on function public.finalize_expired_dispatch_windows() from public,anon,authenticated;
grant execute on function public.finalize_expired_dispatch_windows() to service_role;
revoke all on function public.get_office_waiting_list() from public,anon;
grant execute on function public.get_office_waiting_list() to authenticated;
revoke all on function public.main_office_publish_load_order(uuid) from public,anon,authenticated;
grant execute on function public.main_office_publish_load_order(uuid) to authenticated;

-- A minute-level scheduler closes expired windows even if no user opens the app.
create extension if not exists pg_cron with schema pg_catalog;
do $$
begin
  if exists(select 1 from cron.job where jobname='tiba-finalize-expired-dispatch-windows') then
    perform cron.unschedule(jobid) from cron.job where jobname='tiba-finalize-expired-dispatch-windows';
  end if;
  perform cron.schedule('tiba-finalize-expired-dispatch-windows','* * * * *',
    $job$select public.finalize_expired_dispatch_windows();$job$);
end;
$$;

notify pgrst, 'reload schema';
