-- Tiba-Supplies clean Phase 1 baseline. Apply to Shadow only.
create extension if not exists pgcrypto;

create table public.offices (
  office_id uuid primary key default gen_random_uuid(),
  office_code text not null unique check (office_code in ('MAIN','RAS_SEDR')),
  name text not null,
  office_type text not null check (office_type in ('HEAD_OFFICE','BRANCH')),
  is_active boolean not null default true,
  latitude double precision,
  longitude double precision,
  geofence_radius_m integer not null default 10000 check (geofence_radius_m between 100 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or
    (latitude between -90 and 90 and longitude between -180 and 180)),
  unique (office_type)
);

create table public.app_users (
  user_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('ADMIN','HEAD_OFFICE')),
  office_id uuid not null references public.offices(office_id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.factories (
  factory_id uuid primary key default gen_random_uuid(),
  factory_code text not null unique,
  name text not null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quarries (
  quarry_id uuid primary key default gen_random_uuid(),
  quarry_code text not null unique,
  name text not null,
  latitude double precision,
  longitude double precision,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or
    (latitude between -90 and 90 and longitude between -180 and 180))
);

create table public.vehicle_owners (
  owner_id uuid primary key default gen_random_uuid(),
  owner_code text not null unique,
  name text not null,
  phone text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  vehicle_id uuid primary key default gen_random_uuid(),
  vehicle_code text not null unique,
  plate_number text not null unique,
  owner_id uuid references public.vehicle_owners(owner_id) on delete restrict,
  office_id uuid not null references public.offices(office_id) on delete restrict,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drivers (
  driver_id uuid primary key default gen_random_uuid(),
  driver_code text not null unique,
  name text not null,
  phone text,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  office_id uuid not null references public.offices(office_id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.load_orders (
  load_order_id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  factory_id uuid not null references public.factories(factory_id) on delete restrict,
  quarry_id uuid not null references public.quarries(quarry_id) on delete restrict,
  created_by uuid not null references public.app_users(user_id) on delete restrict,
  requested_quantity integer not null check (requested_quantity > 0),
  priority smallint not null default 3 check (priority between 1 and 5),
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','IN_PROGRESS','COMPLETED','CANCELLED')),
  notes text,
  published_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.app_users(user_id) on delete restrict,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status <> 'CANCELLED') or (cancelled_at is not null and cancellation_reason is not null))
);

create table public.bookings (
  booking_id uuid primary key default gen_random_uuid(),
  load_order_id uuid not null references public.load_orders(load_order_id) on delete restrict,
  driver_id uuid not null references public.drivers(driver_id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(vehicle_id) on delete restrict,
  assigned_by uuid not null references public.app_users(user_id) on delete restrict,
  assignment_type text not null check (assignment_type in ('QUEUE','DIRECT')),
  status text not null default 'ASSIGNED' check (status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT','DELIVERED','CANCELLED')),
  trip_code text not null unique,
  assigned_at timestamptz not null default now(),
  arrived_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index bookings_one_active_driver on public.bookings(driver_id)
  where status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT');
create unique index bookings_one_active_vehicle on public.bookings(vehicle_id)
  where status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT');

create table public.actual_loading_records (
  actual_load_id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(booking_id) on delete restrict,
  actual_weight numeric(12,3) not null check (actual_weight > 0),
  ticket_number text,
  scale_image_path text,
  loaded_at timestamptz not null default now(),
  recorded_by uuid not null references public.app_users(user_id) on delete restrict,
  notes text,
  created_at timestamptz not null default now()
);

create table public.delivery_confirmations (
  delivery_confirmation_id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(booking_id) on delete restrict,
  confirmed_by_driver_id uuid not null references public.drivers(driver_id) on delete restrict,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  confirmed_at timestamptz not null default now(),
  notes text
);

create table public.driver_live_locations (
  driver_id uuid primary key references public.drivers(driver_id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  captured_at timestamptz not null,
  received_at timestamptz not null default now()
);

create table public.notifications (
  notification_id uuid primary key default gen_random_uuid(),
  recipient_driver_id uuid references public.drivers(driver_id) on delete cascade,
  recipient_user_id uuid references public.app_users(user_id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(recipient_driver_id, recipient_user_id) = 1)
);

create table public.audit_log (
  audit_id bigint generated always as identity primary key,
  actor_auth_user_id uuid,
  actor_app_user_id uuid references public.app_users(user_id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Fixed office seed only; no real users, credentials, or business records.
insert into public.offices (office_code,name,office_type,is_active,latitude,longitude,geofence_radius_m)
values
  ('MAIN','المكتب الرئيسي','HEAD_OFFICE',true,null,null,10000),
  ('RAS_SEDR','مكتب رأس سدر','BRANCH',true,null,null,10000);

-- Client access is mediated by vetted RPCs/Edge Functions; no direct table grants.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname='public'
    and tablename in ('offices','app_users','factories','quarries','vehicle_owners','vehicles','drivers',
      'load_orders','bookings','actual_loading_records','delivery_confirmations','driver_live_locations','notifications','audit_log')
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on table public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;

revoke all on sequence public.load_orders_order_number_seq from anon, authenticated;
revoke all on sequence public.audit_log_audit_id_seq from anon, authenticated;
