-- Phase 1 correction: assignment/loading data is not actual factory-delivery weight.
-- Apply only through the reviewed clean Shadow migration chain. Never apply to Production
-- until the Production schema and historical data have been reconciled separately.

-- Keep the assignment/loading sheet separate from actual weight recorded at the factory.
create table if not exists public.loading_data_records (
  loading_data_id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(booking_id) on delete restrict,
  load_order_id uuid not null references public.load_orders(load_order_id) on delete restrict,
  driver_id uuid not null references public.drivers(driver_id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(vehicle_id) on delete restrict,
  factory_id uuid not null references public.factories(factory_id) on delete restrict,
  quarry_id uuid not null references public.quarries(quarry_id) on delete restrict,
  assigned_by uuid not null references public.app_users(user_id) on delete restrict,
  trip_code text not null unique,
  assignment_type text not null check (assignment_type in ('QUEUE','DIRECT')),
  booking_status text not null check (booking_status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT','DELIVERED','CANCELLED')),
  load_order_number bigint,
  load_date date not null,
  assigned_at timestamptz not null,
  arrived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.loading_data_records enable row level security;
revoke all on table public.loading_data_records from anon, authenticated;
create index if not exists loading_data_records_load_date_idx
  on public.loading_data_records(load_date desc, loading_data_id);
create index if not exists loading_data_records_factory_quarry_idx
  on public.loading_data_records(factory_id, quarry_id, load_date desc);

-- Actual-loading records can also originate from historical paper data without a booking.
-- A booking remains unique when present; PostgreSQL permits multiple NULLs in a UNIQUE key.
alter table public.actual_loading_records alter column booking_id drop not null;
alter table public.actual_loading_records alter column recorded_by drop not null;
alter table public.actual_loading_records
  add column if not exists recorded_by_driver_id uuid references public.drivers(driver_id) on delete restrict;
alter table public.actual_loading_records
  add column if not exists load_date date;
alter table public.actual_loading_records
  add column if not exists vehicle_id uuid references public.vehicles(vehicle_id) on delete restrict;
alter table public.actual_loading_records
  add column if not exists driver_id uuid references public.drivers(driver_id) on delete restrict;
alter table public.actual_loading_records
  add column if not exists quarry_id uuid references public.quarries(quarry_id) on delete restrict;
alter table public.actual_loading_records
  add column if not exists factory_id uuid references public.factories(factory_id) on delete restrict;
alter table public.actual_loading_records
  add column if not exists trip_code text;
alter table public.actual_loading_records
  add column if not exists daily_load_number bigint;
alter table public.actual_loading_records
  add column if not exists loading_sequence_date date;
alter table public.actual_loading_records
  add column if not exists actual_weight_recorded_at timestamptz;
alter table public.actual_loading_records
  add column if not exists record_source text;

-- Preserve pre-existing rows as legacy evidence; do not relabel old office-entered weights
-- as driver-confirmed factory deliveries.
update public.actual_loading_records alr
set load_date = coalesce(alr.load_date, alr.loaded_at::date, alr.created_at::date),
    loading_sequence_date = coalesce(alr.loading_sequence_date, alr.loaded_at::date, alr.created_at::date),
    actual_weight_recorded_at = coalesce(alr.actual_weight_recorded_at, alr.loaded_at, alr.created_at),
    record_source = coalesce(alr.record_source, 'LEGACY'),
    vehicle_id = coalesce(alr.vehicle_id, b.vehicle_id),
    driver_id = coalesce(alr.driver_id, b.driver_id),
    trip_code = coalesce(alr.trip_code, b.trip_code),
    factory_id = coalesce(alr.factory_id, lo.factory_id),
    quarry_id = coalesce(alr.quarry_id, lo.quarry_id)
from public.bookings b
left join public.load_orders lo on lo.load_order_id = b.load_order_id
where alr.booking_id = b.booking_id;

update public.actual_loading_records
set load_date = coalesce(load_date, loaded_at::date, created_at::date),
    loading_sequence_date = coalesce(loading_sequence_date, load_date, loaded_at::date, created_at::date),
    actual_weight_recorded_at = coalesce(actual_weight_recorded_at, loaded_at, created_at),
    record_source = coalesce(record_source, 'LEGACY')
where load_date is null
   or loading_sequence_date is null
   or actual_weight_recorded_at is null
   or record_source is null;

alter table public.actual_loading_records
  alter column load_date set default current_date,
  alter column actual_weight_recorded_at set default now(),
  alter column record_source set default 'DRIVER_DELIVERY',
  alter column record_source set not null;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.actual_loading_records'::regclass
      and conname = 'actual_loading_records_source_check'
  ) then
    alter table public.actual_loading_records
      add constraint actual_loading_records_source_check
      check (record_source in ('DRIVER_DELIVERY','PAPER_IMPORT','OFFICE_CORRECTION','LEGACY'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.actual_loading_records'::regclass
      and conname = 'actual_loading_records_source_fields_check'
  ) then
    alter table public.actual_loading_records
      add constraint actual_loading_records_source_fields_check
      check (
        booking_id is not null
        or (load_date is not null and vehicle_id is not null and driver_id is not null
            and quarry_id is not null and factory_id is not null)
      );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.actual_loading_records'::regclass
      and conname = 'actual_loading_records_driver_source_check'
  ) then
    alter table public.actual_loading_records
      add constraint actual_loading_records_driver_source_check
      check (record_source <> 'DRIVER_DELIVERY' or recorded_by_driver_id is not null);
  end if;
end;
$constraints$;

create index if not exists actual_loading_records_load_date_idx
  on public.actual_loading_records(load_date desc, actual_load_id);
create index if not exists actual_loading_records_vehicle_date_idx
  on public.actual_loading_records(vehicle_id, load_date desc);
create index if not exists actual_loading_records_factory_quarry_date_idx
  on public.actual_loading_records(factory_id, quarry_id, load_date desc);
create unique index if not exists actual_loading_records_trip_code_unique
  on public.actual_loading_records(trip_code) where trip_code is not null;

-- Backfill the separate assignment/loading sheet from bookings; this does not create
-- actual weight records and therefore cannot make an assigned trip look delivered.
insert into public.loading_data_records (
  booking_id, load_order_id, driver_id, vehicle_id, factory_id, quarry_id, assigned_by,
  trip_code, assignment_type, booking_status, load_order_number, load_date, assigned_at, arrived_at
)
select b.booking_id, b.load_order_id, b.driver_id, b.vehicle_id, lo.factory_id, lo.quarry_id,
       b.assigned_by, b.trip_code, b.assignment_type, b.status, lo.order_number,
       b.assigned_at::date, b.assigned_at, b.arrived_at
from public.bookings b
join public.load_orders lo on lo.load_order_id = b.load_order_id
on conflict (booking_id) do nothing;

create or replace function public.sync_booking_loading_data()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.load_orders%rowtype;
begin
  select * into v_order
  from public.load_orders
  where load_order_id = new.load_order_id;
  if not found then
    raise exception 'LOADING_DATA_LOAD_ORDER_NOT_FOUND';
  end if;

  insert into public.loading_data_records (
    booking_id, load_order_id, driver_id, vehicle_id, factory_id, quarry_id, assigned_by,
    trip_code, assignment_type, booking_status, load_order_number, load_date, assigned_at, arrived_at
  ) values (
    new.booking_id, new.load_order_id, new.driver_id, new.vehicle_id, v_order.factory_id,
    v_order.quarry_id, new.assigned_by, new.trip_code, new.assignment_type, new.status,
    v_order.order_number, new.assigned_at::date, new.assigned_at, new.arrived_at
  )
  on conflict (booking_id) do update set
    load_order_id = excluded.load_order_id,
    driver_id = excluded.driver_id,
    vehicle_id = excluded.vehicle_id,
    factory_id = excluded.factory_id,
    quarry_id = excluded.quarry_id,
    assigned_by = excluded.assigned_by,
    trip_code = excluded.trip_code,
    assignment_type = excluded.assignment_type,
    booking_status = excluded.booking_status,
    load_order_number = excluded.load_order_number,
    load_date = excluded.load_date,
    assigned_at = excluded.assigned_at,
    arrived_at = excluded.arrived_at,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists bookings_sync_loading_data on public.bookings;
create trigger bookings_sync_loading_data
after insert or update of load_order_id, driver_id, vehicle_id, assigned_by, assignment_type,
  status, trip_code, assigned_at, arrived_at
on public.bookings
for each row execute function public.sync_booking_loading_data();

revoke all on function public.sync_booking_loading_data() from public, anon, authenticated;

-- The office workflow records assignment/loading progress only. Actual weight and scale
-- evidence are captured atomically by driver_confirm_delivery at factory delivery.
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
  if p_actual_weight is not null or nullif(trim(p_ticket_number), '') is not null then
    raise exception 'ACTUAL_WEIGHT_CAPTURED_AT_DELIVERY';
  end if;
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
  if v_next='LOADING' and v_booking.status<>'ARRIVED' then
    raise exception 'ARRIVAL_REQUIRED_BEFORE_LOADING';
  end if;
  if v_next='LOADED' and v_booking.status<>'LOADING' then
    raise exception 'LOADING_STATE_REQUIRED';
  end if;
  if v_next='IN_TRANSIT' and v_booking.status<>'LOADED' then
    raise exception 'LOADED_STATE_REQUIRED';
  end if;
  if v_next='DELIVERED' then
    if v_booking.status<>'IN_TRANSIT' then raise exception 'IN_TRANSIT_STATE_REQUIRED'; end if;
    if not exists (
      select 1 from public.delivery_confirmations dc
      where dc.booking_id=p_booking_id and dc.confirmed_by_driver_id=v_booking.driver_id
    ) then
      raise exception 'DRIVER_DELIVERY_CONFIRMATION_REQUIRED';
    end if;
  end if;
  if v_next='CANCELLED' then
    if nullif(trim(p_notes),'') is null then raise exception 'CANCELLATION_REASON_REQUIRED'; end if;
    if v_booking.status in ('LOADING','LOADED','IN_TRANSIT') then
      raise exception 'TRIP_PROGRESS_PREVENTS_CANCELLATION';
    end if;
    update public.bookings
    set cancellation_reason=trim(p_notes), cancelled_at=now()
    where booking_id=p_booking_id;
  end if;

  update public.bookings set status=v_next,updated_at=now()
  where booking_id=p_booking_id;

  if v_next='DELIVERED' then
    update public.load_orders lo set status=case
      when not exists (
        select 1 from public.bookings b
        where b.load_order_id=lo.load_order_id
          and b.status not in ('DELIVERED','CANCELLED')
          and b.booking_id<>p_booking_id
      ) then 'COMPLETED' else 'IN_PROGRESS' end,
      updated_at=now()
    where lo.load_order_id=v_booking.load_order_id;
  end if;
  if v_next='CANCELLED' then
    update public.load_orders lo set status=case
      when exists (
        select 1 from public.bookings b
        where b.load_order_id=lo.load_order_id
          and b.status not in ('DELIVERED','CANCELLED')
      ) then 'IN_PROGRESS' else 'PUBLISHED' end,
      updated_at=now()
    where lo.load_order_id=v_booking.load_order_id and lo.status not in ('COMPLETED','CANCELLED');
  end if;

  perform public.write_audit_event('ADVANCE_BOOKING_'||v_next,'BOOKING',p_booking_id,
    jsonb_build_object('previous_status',v_booking.status,'next_status',v_next,
      'weight_capture_stage','FACTORY_DELIVERY','notes',p_notes));
  return jsonb_build_object('booking_id',p_booking_id,'previous_status',v_booking.status,'status',v_next,
    'weight_capture_stage','FACTORY_DELIVERY');
end;
$$;

revoke all on function public.main_office_advance_booking(uuid,text,numeric,text,text) from public, anon, authenticated;
grant execute on function public.main_office_advance_booking(uuid,text,numeric,text,text) to authenticated;

-- Final delivery is the only current-flow writer of actual weight.
create or replace function public.driver_confirm_delivery(
  p_booking_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision,
  p_captured_at timestamptz,
  p_actual_weight numeric,
  p_scale_image_path text default null,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_driver public.drivers%rowtype;
  v_booking public.bookings%rowtype;
  v_confirmation public.delivery_confirmations%rowtype;
  v_actual public.actual_loading_records%rowtype;
  v_order public.load_orders%rowtype;
  v_inserted boolean := false;
  v_weight numeric(12,3) := round(p_actual_weight,3);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_booking_id is null then raise exception 'BOOKING_ID_REQUIRED'; end if;
  if p_latitude is null or p_latitude not between -90 and 90
     or p_longitude is null or p_longitude not between -180 and 180 then
    raise exception 'INVALID_COORDINATES';
  end if;
  if p_accuracy_m is null or p_accuracy_m < 0 or p_accuracy_m > 100 then
    raise exception 'LOCATION_ACCURACY_TOO_LOW';
  end if;
  if p_captured_at is null or p_captured_at < now()-interval '10 minutes'
     or p_captured_at > now()+interval '1 minute' then
    raise exception 'LOCATION_TIMESTAMP_STALE_OR_INVALID';
  end if;
  if p_actual_weight is null or p_actual_weight <= 0 or p_actual_weight > 1000 then
    raise exception 'POSITIVE_ACTUAL_WEIGHT_REQUIRED';
  end if;
  if p_scale_image_path is not null and length(trim(p_scale_image_path)) > 500 then
    raise exception 'INVALID_SCALE_IMAGE_PATH';
  end if;
  if p_scale_image_path is not null and (
    p_scale_image_path like '/%' or p_scale_image_path like '%..%'
    or p_scale_image_path like '%://%' or p_scale_image_path like '%\%'
  ) then
    raise exception 'INVALID_SCALE_IMAGE_PATH';
  end if;

  select * into v_driver from public.drivers
  where auth_user_id=auth.uid() and is_active=true for update;
  if not found then raise exception 'ACTIVE_DRIVER_ACCOUNT_REQUIRED'; end if;

  select * into v_booking from public.bookings
  where booking_id=p_booking_id and driver_id=v_driver.driver_id for update;
  if not found then raise exception 'BOOKING_NOT_YOURS'; end if;
  if v_booking.status <> 'IN_TRANSIT' then raise exception 'BOOKING_NOT_IN_TRANSIT'; end if;

  select * into v_order from public.load_orders
  where load_order_id=v_booking.load_order_id;
  if not found then raise exception 'LOAD_ORDER_NOT_FOUND'; end if;

  select * into v_actual from public.actual_loading_records
  where booking_id=p_booking_id for update;
  if found then
    if v_actual.actual_weight is not null and v_actual.actual_weight <> v_weight then
      raise exception 'ACTUAL_WEIGHT_ALREADY_RECORDED';
    end if;
    update public.actual_loading_records
    set scale_image_path=coalesce(scale_image_path,nullif(trim(p_scale_image_path),'')),
        notes=coalesce(nullif(trim(p_notes),''),notes)
    where actual_load_id=v_actual.actual_load_id;
  else
    insert into public.actual_loading_records(
      booking_id, actual_weight, ticket_number, scale_image_path, loaded_at,
      recorded_by, recorded_by_driver_id, notes, load_date, vehicle_id, driver_id,
      quarry_id, factory_id, trip_code, daily_load_number, loading_sequence_date,
      actual_weight_recorded_at, record_source
    ) values (
      p_booking_id, v_weight, null, nullif(trim(p_scale_image_path),''), now(),
      null, v_driver.driver_id, nullif(trim(p_notes),''), current_date,
      v_booking.vehicle_id, v_driver.driver_id, v_order.quarry_id, v_order.factory_id,
      v_booking.trip_code, null, current_date, now(), 'DRIVER_DELIVERY'
    );
    v_inserted := true;
  end if;

  insert into public.delivery_confirmations(
    booking_id,confirmed_by_driver_id,latitude,longitude,confirmed_at,notes
  ) values (
    p_booking_id,v_driver.driver_id,p_latitude,p_longitude,now(),nullif(trim(p_notes),'')
  ) on conflict(booking_id) do nothing;

  select * into v_confirmation from public.delivery_confirmations where booking_id=p_booking_id;
  if v_confirmation.confirmed_by_driver_id <> v_driver.driver_id then
    raise exception 'DELIVERY_CONFIRMATION_CONFLICT';
  end if;

  if not exists (
    select 1 from public.audit_log al
    where al.actor_auth_user_id=auth.uid()
      and al.action='DRIVER_CONFIRM_DELIVERY'
      and al.entity_id=p_booking_id
  ) then
    insert into public.audit_log(actor_auth_user_id,actor_app_user_id,action,entity_type,entity_id,details)
    values(auth.uid(),null,'DRIVER_CONFIRM_DELIVERY','BOOKING',p_booking_id,
      jsonb_build_object('driver_id',v_driver.driver_id,'actual_weight',v_weight,
        'scale_image_attached',p_scale_image_path is not null,'accuracy_m',p_accuracy_m,
        'captured_at',p_captured_at,'confirmed_at',v_confirmation.confirmed_at,
        'record_source','DRIVER_DELIVERY'));
  end if;

  select * into v_actual from public.actual_loading_records where booking_id=p_booking_id;
  return jsonb_build_object(
    'booking_id',p_booking_id,'confirmed',true,'actual_weight',v_weight,
    'actual_load_created',v_inserted,'scale_image_attached',v_actual.scale_image_path is not null,
    'actual_weight_recorded_at',v_actual.actual_weight_recorded_at,
    'confirmed_at',v_confirmation.confirmed_at
  );
end;
$$;

revoke all on function public.driver_confirm_delivery(uuid,double precision,double precision,double precision,timestamptz,numeric,text,text) from public, anon, authenticated;
grant execute on function public.driver_confirm_delivery(uuid,double precision,double precision,double precision,timestamptz,numeric,text,text) to authenticated;

-- Reporting RPCs include both booked trips and standalone paper actual-loading records.
create or replace function public.get_vehicle_owner_reports(
  p_from date default null,
  p_to date default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.app_users au
    where au.auth_user_id=auth.uid() and au.is_active=true
      and au.role in ('ADMIN','HEAD_OFFICE','BRANCH')
  ) then raise exception 'INSUFFICIENT_ROLE'; end if;
  if p_from is not null and p_to is not null and p_from>p_to then
    raise exception 'INVALID_DATE_RANGE';
  end if;

  select jsonb_build_object(
    'vehicles',coalesce((
      select jsonb_agg(jsonb_build_object('vehicle_id',v.vehicle_id,'plate_number',v.plate_number,
        'vehicle_code',v.vehicle_code,'owner_id',vo.owner_id,'owner_name',vo.name,
        'owner_phone',vo.phone,'is_active',v.is_active) order by v.plate_number)
      from public.vehicles v left join public.vehicle_owners vo on vo.owner_id=v.owner_id
    ),'[]'::jsonb),
    'owners',coalesce((
      select jsonb_agg(jsonb_build_object('owner_id',vo.owner_id,'name',vo.name,'phone',vo.phone,
        'is_active',vo.is_active,'vehicle_count',(select count(*) from public.vehicles v2 where v2.owner_id=vo.owner_id))
        order by vo.name) from public.vehicle_owners vo
    ),'[]'::jsonb),
    'trips',coalesce((
      select jsonb_agg(jsonb_build_object(
        'actual_load_id',alr.actual_load_id,'booking_id',alr.booking_id,
        'trip_code',coalesce(alr.trip_code,b.trip_code),
        'daily_load_number',alr.daily_load_number,
        'loading_sequence_date',coalesce(alr.loading_sequence_date,alr.load_date,alr.loaded_at::date),
        'load_date',coalesce(alr.load_date,alr.loaded_at::date),
        'created_at',alr.created_at,
        'vehicle_id',coalesce(alr.vehicle_id,b.vehicle_id),'plate_number',v.plate_number,
        'vehicle_code',v.vehicle_code,'owner_id',vo.owner_id,'owner_name',vo.name,
        'driver_name',d.name,'quarry_name',q.name,'factory_name',f.name,
        'ticket_number',alr.ticket_number,'actual_weight',alr.actual_weight,
        'scale_image_path',alr.scale_image_path,'delivery_confirmed_at',dc.confirmed_at,
        'actual_weight_recorded_at',alr.actual_weight_recorded_at,
        'record_source',alr.record_source,
        'is_completed',(alr.actual_weight is not null and (b.booking_id is null or dc.confirmed_at is not null))
      ) order by coalesce(alr.load_date,alr.loaded_at::date,alr.created_at::date) desc,alr.created_at desc)
      from public.actual_loading_records alr
      left join public.bookings b on b.booking_id=alr.booking_id
      left join public.load_orders lo on lo.load_order_id=b.load_order_id
      left join public.vehicles v on v.vehicle_id=coalesce(alr.vehicle_id,b.vehicle_id)
      left join public.vehicle_owners vo on vo.owner_id=v.owner_id
      left join public.drivers d on d.driver_id=coalesce(alr.driver_id,b.driver_id)
      left join public.factories f on f.factory_id=coalesce(alr.factory_id,lo.factory_id)
      left join public.quarries q on q.quarry_id=coalesce(alr.quarry_id,lo.quarry_id)
      left join public.delivery_confirmations dc on dc.booking_id=b.booking_id
      where (p_from is null or coalesce(alr.load_date,alr.loaded_at::date,alr.created_at::date)>=p_from)
        and (p_to is null or coalesce(alr.load_date,alr.loaded_at::date,alr.created_at::date)<=p_to)
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.get_vehicle_owner_reports(date,date) from public,anon,authenticated;
grant execute on function public.get_vehicle_owner_reports(date,date) to authenticated;

create or replace function public.get_account_statement_records(
  p_from date default null,
  p_to date default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.app_users au
    where au.auth_user_id=auth.uid() and au.is_active=true
      and au.role in ('ADMIN','HEAD_OFFICE')
  ) then raise exception 'INSUFFICIENT_ROLE'; end if;
  if p_from is not null and p_to is not null and p_from>p_to then
    raise exception 'INVALID_DATE_RANGE';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'actual_load_id',alr.actual_load_id,'booking_id',alr.booking_id,
    'load_date',coalesce(alr.load_date,alr.loaded_at::date),
    'loading_sequence_date',coalesce(alr.loading_sequence_date,alr.load_date,alr.loaded_at::date),
    'created_at',alr.created_at,'trip_code',coalesce(alr.trip_code,b.trip_code),
    'daily_load_number',alr.daily_load_number,'ticket_number',alr.ticket_number,
    'actual_weight',alr.actual_weight,'vehicle_id',coalesce(alr.vehicle_id,b.vehicle_id),
    'plate_number',v.plate_number,'driver_id',coalesce(alr.driver_id,b.driver_id),
    'driver_name',d.name,'factory_id',coalesce(alr.factory_id,lo.factory_id),
    'factory_name',f.name,'quarry_id',coalesce(alr.quarry_id,lo.quarry_id),
    'quarry_name',q.name,'scale_image_path',alr.scale_image_path,
    'delivery_confirmed_at',dc.confirmed_at,
    'actual_weight_recorded_at',alr.actual_weight_recorded_at,'record_source',alr.record_source
  ) order by coalesce(alr.load_date,alr.loaded_at::date,alr.created_at::date) desc,alr.created_at desc),'[]'::jsonb)
  into v_result
  from public.actual_loading_records alr
  left join public.bookings b on b.booking_id=alr.booking_id
  left join public.load_orders lo on lo.load_order_id=b.load_order_id
  left join public.vehicles v on v.vehicle_id=coalesce(alr.vehicle_id,b.vehicle_id)
  left join public.drivers d on d.driver_id=coalesce(alr.driver_id,b.driver_id)
  left join public.factories f on f.factory_id=coalesce(alr.factory_id,lo.factory_id)
  left join public.quarries q on q.quarry_id=coalesce(alr.quarry_id,lo.quarry_id)
  left join public.delivery_confirmations dc on dc.booking_id=b.booking_id
  where (p_from is null or coalesce(alr.load_date,alr.loaded_at::date,alr.created_at::date)>=p_from)
    and (p_to is null or coalesce(alr.load_date,alr.loaded_at::date,alr.created_at::date)<=p_to);
  return v_result;
end;
$$;
revoke all on function public.get_account_statement_records(date,date) from public,anon,authenticated;
grant execute on function public.get_account_statement_records(date,date) to authenticated;

notify pgrst, 'reload schema';
