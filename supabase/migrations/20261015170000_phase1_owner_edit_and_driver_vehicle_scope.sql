-- Phase 1 change 2: complete owner editing and harden driver/vehicle directory linkage.
-- Main Office directory only. Does not touch native location tracking or tracking tables.

create or replace function public.main_office_update_vehicle_owner(
  p_owner_id uuid,
  p_name text,
  p_phone text default null,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_owner public.vehicle_owners%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  v_actor := public.current_main_office_user();
  if p_owner_id is null or v_name = '' then
    raise exception 'OWNER_ID_AND_NAME_REQUIRED';
  end if;

  select * into v_owner
  from public.vehicle_owners
  where owner_id = p_owner_id
  for update;
  if not found then raise exception 'OWNER_NOT_FOUND'; end if;

  update public.vehicle_owners
  set name = v_name,
      phone = v_phone,
      notes = v_notes,
      updated_at = now()
  where owner_id = p_owner_id;

  perform public.write_audit_event(
    'UPDATE_OWNER', 'VEHICLE_OWNER', p_owner_id,
    jsonb_build_object(
      'owner_code', v_owner.owner_code,
      'old_name', v_owner.name,
      'name', v_name,
      'phone_changed', v_owner.phone is distinct from v_phone,
      'notes_changed', v_owner.notes is distinct from v_notes
    )
  );

  return jsonb_build_object(
    'success', true,
    'owner_id', p_owner_id,
    'owner_code', v_owner.owner_code,
    'name', v_name,
    'phone', v_phone
  );
end;
$$;

revoke all on function public.main_office_update_vehicle_owner(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.main_office_update_vehicle_owner(uuid, text, text, text) to authenticated;

create or replace function public.main_office_update_driver(
  p_driver_id uuid,
  p_name text,
  p_phone text,
  p_driver_code text,
  p_vehicle_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_office uuid;
  v_driver public.drivers%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_code text := nullif(trim(coalesce(p_driver_code, '')), '');
  v_old_vehicle uuid;
begin
  v_actor := public.current_main_office_user();

  if p_driver_id is null or v_name = '' or v_phone = '' or p_vehicle_id is null then
    raise exception 'DRIVER_ID_NAME_PHONE_AND_VEHICLE_REQUIRED';
  end if;
  if v_phone !~ '^(01[0125][0-9]{8}|\+?20(10|11|12|15)[0-9]{8}|00?20(10|11|12|15)[0-9]{8})$' then
    raise exception 'DRIVER_PHONE_INVALID';
  end if;

  select office_id into v_office
  from public.offices
  where office_code = 'RAS_SEDR' and office_type = 'BRANCH' and is_active = true;
  if v_office is null then raise exception 'RAS_SEDR_BRANCH_CONFIGURATION_INVALID'; end if;

  select * into v_driver from public.drivers where driver_id = p_driver_id for update;
  if not found then raise exception 'DRIVER_NOT_FOUND'; end if;
  if v_driver.office_id <> v_office then raise exception 'DRIVER_NOT_ASSIGNED_TO_RAS_SEDR'; end if;
  if v_driver.auth_user_id is not null and v_phone is distinct from v_driver.phone then
    raise exception 'DRIVER_LOGIN_PHONE_CHANGE_REQUIRES_ACCOUNT_UPDATE';
  end if;
  if exists (
    select 1 from public.drivers d
    where d.driver_id <> p_driver_id
      and regexp_replace(coalesce(d.phone, ''), '[^0-9]', '', 'g') =
          regexp_replace(v_phone, '[^0-9]', '', 'g')
  ) then raise exception 'DRIVER_PHONE_EXISTS'; end if;

  select * into v_vehicle
  from public.vehicles
  where vehicle_id = p_vehicle_id and is_active = true
  for update;
  if not found then raise exception 'VEHICLE_NOT_AVAILABLE'; end if;
  if v_vehicle.office_id <> v_office then raise exception 'VEHICLE_NOT_AVAILABLE_IN_TARGET_BRANCH'; end if;

  select vehicle_id into v_old_vehicle
  from public.driver_vehicle_assignments
  where driver_id = p_driver_id and ended_at is null
  for update;

  if v_old_vehicle is distinct from p_vehicle_id then
    if exists (
      select 1 from public.bookings
      where driver_id = p_driver_id
        and status in ('ASSIGNED', 'ARRIVED', 'LOADING', 'LOADED', 'IN_TRANSIT')
    ) then raise exception 'DRIVER_HAS_ACTIVE_BOOKING'; end if;

    if exists (
      select 1 from public.driver_vehicle_assignments
      where vehicle_id = p_vehicle_id and ended_at is null and driver_id <> p_driver_id
    ) then raise exception 'VEHICLE_ALREADY_ASSIGNED'; end if;

    if exists (
      select 1 from public.bookings
      where vehicle_id = p_vehicle_id
        and status in ('ASSIGNED', 'ARRIVED', 'LOADING', 'LOADED', 'IN_TRANSIT')
        and driver_id <> p_driver_id
    ) then raise exception 'VEHICLE_HAS_ACTIVE_BOOKING'; end if;

    update public.driver_vehicle_assignments
    set ended_at = now()
    where driver_id = p_driver_id and ended_at is null;

    insert into public.driver_vehicle_assignments(driver_id, vehicle_id, assigned_by)
    values (p_driver_id, p_vehicle_id, v_actor);

    perform public.write_audit_event(
      'REASSIGN_DRIVER_VEHICLE', 'DRIVER_VEHICLE_ASSIGNMENT', p_driver_id,
      jsonb_build_object('previous_vehicle_id', v_old_vehicle, 'vehicle_id', p_vehicle_id)
    );
  end if;

  update public.drivers
  set name = v_name,
      phone = v_phone,
      driver_code = coalesce(v_code, driver_code),
      updated_at = now()
  where driver_id = p_driver_id;

  perform public.write_audit_event(
    'UPDATE_DRIVER', 'DRIVER', p_driver_id,
    jsonb_build_object(
      'name', v_name,
      'phone_changed', v_driver.phone is distinct from v_phone,
      'driver_code', coalesce(v_code, v_driver.driver_code),
      'vehicle_id', p_vehicle_id
    )
  );

  return jsonb_build_object('success', true, 'driver_id', p_driver_id, 'vehicle_id', p_vehicle_id);
end;
$$;

revoke all on function public.main_office_update_driver(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.main_office_update_driver(uuid, text, text, text, uuid) to authenticated;
notify pgrst, 'reload schema';
