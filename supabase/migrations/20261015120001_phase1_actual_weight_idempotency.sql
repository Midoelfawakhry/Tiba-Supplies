-- Phase 1: make driver delivery confirmation idempotent at persisted weight precision.
-- A pre-created actual_loading_records row is completed in place; never create a second
-- actual-weight record for a booking. Repeated confirmations may add missing evidence/notes
-- but cannot replace an already-recorded weight.
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
    if v_actual.actual_weight is not null
       and v_actual.actual_weight <> round(p_actual_weight,3) then
      raise exception 'ACTUAL_WEIGHT_ALREADY_RECORDED';
    end if;
    update public.actual_loading_records
    set actual_weight = round(p_actual_weight,3),
        recorded_by_driver_id = coalesce(recorded_by_driver_id,v_driver.driver_id),
        loaded_at = coalesce(loaded_at,now()),
        scale_image_path = coalesce(scale_image_path,nullif(trim(p_scale_image_path),'')),
        notes = coalesce(nullif(trim(p_notes),''),notes)
    where actual_load_id=v_actual.actual_load_id
      and actual_weight is null;
    if not found then
      update public.actual_loading_records
      set scale_image_path = coalesce(scale_image_path,nullif(trim(p_scale_image_path),'')),
          notes = coalesce(nullif(trim(p_notes),''),notes)
      where actual_load_id=v_actual.actual_load_id;
    end if;
  else
    insert into public.actual_loading_records(
      booking_id,actual_weight,scale_image_path,recorded_by,recorded_by_driver_id,notes,loaded_at
    ) values (
      p_booking_id,round(p_actual_weight,3),nullif(trim(p_scale_image_path),''),null,
      v_driver.driver_id,nullif(trim(p_notes),''),now()
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
      jsonb_build_object('driver_id',v_driver.driver_id,'actual_weight',round(p_actual_weight,3),
        'scale_image_attached',p_scale_image_path is not null,
        'accuracy_m',p_accuracy_m,'captured_at',p_captured_at,
        'confirmed_at',v_confirmation.confirmed_at));
  end if;

  return jsonb_build_object(
    'booking_id',p_booking_id,'confirmed',true,
    'actual_weight',round(p_actual_weight,3),
    'actual_load_created',v_inserted,
    'scale_image_attached',coalesce(v_actual.scale_image_path is not null,p_scale_image_path is not null),
    'confirmed_at',v_confirmation.confirmed_at
  );
end; $$;