-- Phase 1: actual scale weight is required at driver delivery confirmation.
-- Driver-recorded actual weights identify the driver separately from office-recorded legacy rows.
alter table public.actual_loading_records alter column recorded_by drop not null;
alter table public.actual_loading_records add column if not exists recorded_by_driver_id uuid references public.drivers(driver_id) on delete restrict;
-- This is one atomic transaction: save the actual weight, confirm delivery, and audit.
-- Also provide the reporting RPCs used by the current office screens; derive factory/quarry
-- from the booking's load order because actual_loading_records is keyed by booking_id only.

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
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_driver public.drivers%rowtype;
  v_booking public.bookings%rowtype;
  v_confirmation public.delivery_confirmations%rowtype;
  v_app_user_id uuid;
  v_actual public.actual_loading_records%rowtype;
  v_inserted boolean := false;
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

  select * into v_driver from public.drivers
  where auth_user_id=auth.uid() and is_active=true for update;
  if not found then raise exception 'ACTIVE_DRIVER_ACCOUNT_REQUIRED'; end if;

  select * into v_booking from public.bookings
  where booking_id=p_booking_id and driver_id=v_driver.driver_id for update;
  if not found then raise exception 'BOOKING_NOT_YOURS'; end if;
  if v_booking.status <> 'IN_TRANSIT' then raise exception 'BOOKING_NOT_IN_TRANSIT'; end if;

  select * into v_actual from public.actual_loading_records
  where booking_id=p_booking_id for update;
  if found then
    if v_actual.actual_weight <> p_actual_weight then
      raise exception 'ACTUAL_WEIGHT_ALREADY_RECORDED';
    end if;
    if p_scale_image_path is not null and v_actual.scale_image_path is null then
      update public.actual_loading_records
      set scale_image_path=p_scale_image_path,
          notes=coalesce(nullif(trim(p_notes),''),notes)
      where actual_load_id=v_actual.actual_load_id;
    end if;
  else
    insert into public.actual_loading_records(
      booking_id,actual_weight,scale_image_path,recorded_by,recorded_by_driver_id,notes,loaded_at
    ) values (
      p_booking_id,round(p_actual_weight,3),nullif(trim(p_scale_image_path),''),
      null,v_driver.driver_id,nullif(trim(p_notes),''),now()
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
      jsonb_build_object('driver_id',v_driver.driver_id,'actual_weight',p_actual_weight,
        'scale_image_attached',p_scale_image_path is not null,
        'accuracy_m',p_accuracy_m,'captured_at',p_captured_at,
        'confirmed_at',v_confirmation.confirmed_at));
  end if;

  return jsonb_build_object(
    'booking_id',p_booking_id,'confirmed',true,
    'actual_weight',round(p_actual_weight,3),
    'actual_load_created',v_inserted,
    'scale_image_attached',p_scale_image_path is not null,
    'confirmed_at',v_confirmation.confirmed_at
  );
end; $$;

revoke all on function public.driver_confirm_delivery(uuid,double precision,double precision,double precision,timestamptz,numeric,text,text) from public,anon,authenticated;
grant execute on function public.driver_confirm_delivery(uuid,double precision,double precision,double precision,timestamptz,numeric,text,text) to authenticated;

-- Retire the older overloads so PostgREST never sees ambiguous delivery-confirmation RPCs.
drop function if exists public.driver_confirm_delivery(uuid,double precision,double precision,double precision,timestamptz,text);
drop function if exists public.driver_confirm_delivery(uuid,double precision,double precision,text);

create or replace function public.get_vehicle_owner_reports(p_from date default null,p_to date default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.app_users au
    join public.user_roles ur on ur.user_id=au.user_id
    join public.roles r on r.role_id=ur.role_id
    where au.auth_user_id=auth.uid() and au.is_active=true
      and r.name in ('ADMIN','HEAD_OFFICE','BRANCH')
  ) then raise exception 'INSUFFICIENT_ROLE'; end if;
  if p_from is not null and p_to is not null and p_from>p_to then raise exception 'INVALID_DATE_RANGE'; end if;

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
        'actual_load_id',alr.actual_load_id,'booking_id',b.booking_id,'trip_code',b.trip_code,
        'daily_load_number',lo.order_number,'loading_sequence_date',alr.loaded_at::date,
        'load_date',alr.loaded_at::date,'created_at',alr.created_at,
        'vehicle_id',v.vehicle_id,'plate_number',v.plate_number,'vehicle_code',v.vehicle_code,
        'owner_id',vo.owner_id,'owner_name',vo.name,'driver_name',d.name,
        'quarry_name',q.name,'factory_name',f.name,'ticket_number',alr.ticket_number,
        'actual_weight',alr.actual_weight,'scale_image_path',alr.scale_image_path,
        'delivery_confirmed_at',dc.confirmed_at,
        'is_completed',(dc.confirmed_at is not null and alr.actual_weight is not null)
      ) order by alr.loaded_at desc,alr.created_at desc)
      from public.actual_loading_records alr
      join public.bookings b on b.booking_id=alr.booking_id
      join public.load_orders lo on lo.load_order_id=b.load_order_id
      left join public.vehicles v on v.vehicle_id=b.vehicle_id
      left join public.vehicle_owners vo on vo.owner_id=v.owner_id
      left join public.drivers d on d.driver_id=b.driver_id
      left join public.factories f on f.factory_id=lo.factory_id
      left join public.quarries q on q.quarry_id=lo.quarry_id
      left join public.delivery_confirmations dc on dc.booking_id=b.booking_id
      where (p_from is null or alr.loaded_at::date>=p_from)
        and (p_to is null or alr.loaded_at::date<=p_to)
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;
revoke all on function public.get_vehicle_owner_reports(date,date) from public,anon;
grant execute on function public.get_vehicle_owner_reports(date,date) to authenticated;

create or replace function public.get_account_statement_records(p_from date default null,p_to date default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.app_users au
    join public.user_roles ur on ur.user_id=au.user_id
    join public.roles r on r.role_id=ur.role_id
    where au.auth_user_id=auth.uid() and au.is_active=true
      and r.name in ('ADMIN','HEAD_OFFICE')
  ) then raise exception 'INSUFFICIENT_ROLE'; end if;
  if p_from is not null and p_to is not null and p_from>p_to then raise exception 'INVALID_DATE_RANGE'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'actual_load_id',alr.actual_load_id,'booking_id',b.booking_id,
    'load_date',alr.loaded_at::date,'loading_sequence_date',alr.loaded_at::date,
    'created_at',alr.created_at,'trip_code',b.trip_code,'daily_load_number',lo.order_number,
    'ticket_number',alr.ticket_number,'actual_weight',alr.actual_weight,
    'vehicle_id',b.vehicle_id,'plate_number',v.plate_number,'driver_id',b.driver_id,
    'driver_name',d.name,'factory_id',lo.factory_id,'factory_name',f.name,
    'quarry_id',lo.quarry_id,'quarry_name',q.name,'scale_image_path',alr.scale_image_path,
    'delivery_confirmed_at',dc.confirmed_at
  ) order by alr.loaded_at desc,alr.created_at desc),'[]'::jsonb)
  into v_result
  from public.actual_loading_records alr
  join public.bookings b on b.booking_id=alr.booking_id
  join public.load_orders lo on lo.load_order_id=b.load_order_id
  left join public.vehicles v on v.vehicle_id=b.vehicle_id
  left join public.drivers d on d.driver_id=b.driver_id
  left join public.factories f on f.factory_id=lo.factory_id
  left join public.quarries q on q.quarry_id=lo.quarry_id
  left join public.delivery_confirmations dc on dc.booking_id=b.booking_id
  where (p_from is null or alr.loaded_at::date>=p_from)
    and (p_to is null or alr.loaded_at::date<=p_to);
  return v_result;
end; $$;
revoke all on function public.get_account_statement_records(date,date) from public,anon;
grant execute on function public.get_account_statement_records(date,date) to authenticated;


-- Optional scale-ticket images. Private bucket; drivers can upload only to their own
-- currently in-transit booking folder. Main Office can read images for reconciliation.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('scale-tickets','scale-tickets',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=10485760,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "driver_upload_own_scale_ticket" on storage.objects;
create policy "driver_upload_own_scale_ticket" on storage.objects
for insert to authenticated
with check (
  bucket_id='scale-tickets'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.bookings b
    join public.drivers d on d.driver_id=b.driver_id
    where b.booking_id=(storage.foldername(name))[1]::uuid
      and d.auth_user_id=auth.uid() and d.is_active=true
      and b.status='IN_TRANSIT'
  )
);

drop policy if exists "read_scale_tickets_for_driver_or_office" on storage.objects;
create policy "read_scale_tickets_for_driver_or_office" on storage.objects
for select to authenticated
using (
  bucket_id='scale-tickets'
  and (
    exists (
      select 1 from public.bookings b
      join public.drivers d on d.driver_id=b.driver_id
      where b.booking_id=(storage.foldername(name))[1]::uuid
        and d.auth_user_id=auth.uid()
    )
    or exists (
      select 1 from public.app_users au
      join public.user_roles ur on ur.user_id=au.user_id
      join public.roles r on r.role_id=ur.role_id
      where au.auth_user_id=auth.uid() and au.is_active=true
        and r.name in ('ADMIN','HEAD_OFFICE')
    )
  )
);
