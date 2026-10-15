-- Compatibility hardening: retain vehicle identity on queue entries and accept legacy queue status labels.
alter table public.waiting_list_entries
  add column if not exists vehicle_id uuid references public.vehicles(vehicle_id) on delete restrict,
  add column if not exists last_check_in_at timestamptz not null default now(),
  add column if not exists assigned_at timestamptz,
  add column if not exists left_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.waiting_list_entries drop constraint if exists waiting_list_entries_status_check;
alter table public.waiting_list_entries
  add constraint waiting_list_entries_status_check
  check (status in ('WAITING','SELECTED','ASSIGNED','LEFT','LEFT_QUEUE','EXPIRED'));

create or replace function public.driver_check_in_queue(p_latitude double precision,p_longitude double precision,p_accuracy_m double precision,p_captured_at timestamptz)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 v_driver public.drivers%rowtype; v_office public.offices%rowtype; v_location public.driver_live_locations%rowtype;
 v_distance_m double precision; v_entry public.waiting_list_entries%rowtype; v_position integer; v_vehicle_id uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_latitude is null or p_latitude not between -90 and 90 or p_longitude is null or p_longitude not between -180 and 180 then raise exception 'INVALID_COORDINATES'; end if;
 if p_accuracy_m is null or p_accuracy_m<0 or p_accuracy_m>100 then raise exception 'LOCATION_ACCURACY_TOO_LOW'; end if;
 if p_captured_at is null or p_captured_at<now()-interval '10 minutes' or p_captured_at>now()+interval '1 minute' then raise exception 'LOCATION_TIMESTAMP_STALE_OR_INVALID'; end if;
 select * into v_driver from public.drivers where auth_user_id=auth.uid() and is_active=true for update;
 if not found then raise exception 'ACTIVE_DRIVER_ACCOUNT_REQUIRED'; end if;
 if exists(select 1 from public.bookings b where b.driver_id=v_driver.driver_id and b.status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT')) then raise exception 'DRIVER_HAS_ACTIVE_BOOKING'; end if;
 select v.vehicle_id into v_vehicle_id from public.driver_vehicle_assignments a join public.vehicles v on v.vehicle_id=a.vehicle_id
 where a.driver_id=v_driver.driver_id and a.ended_at is null and v.is_active=true and v.office_id=v_driver.office_id limit 1 for update of v;
 if v_vehicle_id is null then raise exception 'ACTIVE_LINKED_VEHICLE_REQUIRED'; end if;
 select * into v_office from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true;
 if not found or v_office.latitude is null or v_office.longitude is null then raise exception 'RAS_SEDR_GEOFENCE_NOT_CONFIGURED'; end if;
 v_distance_m:=6371000*2*asin(sqrt(least(1,greatest(0,power(sin(radians(p_latitude-v_office.latitude)/2),2)+cos(radians(v_office.latitude))*cos(radians(p_latitude))*power(sin(radians(p_longitude-v_office.longitude)/2),2)))));
 if v_distance_m>coalesce(v_office.geofence_radius_m,10000) then raise exception 'OUTSIDE_RAS_SEDR_GEOFENCE'; end if;
 select * into v_location from public.driver_live_locations where driver_id=v_driver.driver_id for update;
 if not found or v_location.captured_at<=p_captured_at then
  insert into public.driver_live_locations(driver_id,latitude,longitude,accuracy_m,captured_at,received_at) values(v_driver.driver_id,p_latitude,p_longitude,p_accuracy_m,p_captured_at,now())
  on conflict(driver_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,captured_at=excluded.captured_at,received_at=now()
  where public.driver_live_locations.captured_at<=excluded.captured_at;
 end if;
 select * into v_entry from public.waiting_list_entries where driver_id=v_driver.driver_id and office_id=v_office.office_id and status='WAITING' order by arrived_at desc limit 1 for update;
 if found then
  update public.waiting_list_entries set vehicle_id=v_vehicle_id,last_check_in_at=now(),updated_at=now() where entry_id=v_entry.entry_id returning * into v_entry;
 else
  insert into public.waiting_list_entries(driver_id,vehicle_id,office_id,status) values(v_driver.driver_id,v_vehicle_id,v_office.office_id,'WAITING') returning * into v_entry;
 end if;
 select count(*)::integer+1 into v_position from public.waiting_list_entries w where w.office_id=v_office.office_id and w.status='WAITING' and (w.arrived_at<v_entry.arrived_at or (w.arrived_at=v_entry.arrived_at and w.entry_id<v_entry.entry_id));
 insert into public.audit_log(actor_auth_user_id,actor_app_user_id,action,entity_type,entity_id,details)
 values(auth.uid(),null,'DRIVER_QUEUE_CHECK_IN','WAITING_LIST_ENTRY',v_entry.entry_id,jsonb_build_object('driver_id',v_driver.driver_id,'vehicle_id',v_vehicle_id,'office_id',v_office.office_id,'distance_m',round(v_distance_m::numeric,1),'accuracy_m',p_accuracy_m,'captured_at',p_captured_at,'arrived_at',v_entry.arrived_at));
 return jsonb_build_object('entry_id',v_entry.entry_id,'queue_status',v_entry.status,'queue_position',v_position,'arrived_at',v_entry.arrived_at,'vehicle_id',v_vehicle_id,'distance_m',round(v_distance_m::numeric,1),'radius_m',v_office.geofence_radius_m);
end; $$;
notify pgrst,'reload schema';