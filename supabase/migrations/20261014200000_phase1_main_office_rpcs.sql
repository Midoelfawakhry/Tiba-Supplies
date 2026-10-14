-- Phase 1 server-side authorization and Main Office master-data RPCs.
-- Apply to Tiba-Supplies-Shadow only.
create or replace function public.current_main_office_user()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare v_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  select au.user_id into v_user_id
  from public.app_users au
  join public.offices o on o.office_id=au.office_id
  where au.auth_user_id=auth.uid()
    and au.is_active=true
    and au.role in ('ADMIN','HEAD_OFFICE')
    and o.office_code='MAIN'
    and o.office_type='HEAD_OFFICE'
    and o.is_active=true;
  if v_user_id is null then
    raise exception 'MAIN_OFFICE_ACCESS_REQUIRED' using errcode='42501';
  end if;
  return v_user_id;
end;
$$;

create or replace function public.write_audit_event(
  p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_user_id uuid;
begin
  v_user_id := public.current_main_office_user();
  insert into public.audit_log(actor_auth_user_id, actor_app_user_id, action, entity_type, entity_id, details)
  select auth.uid(), v_user_id, p_action, p_entity_type, p_entity_id, coalesce(p_details,'{}'::jsonb);
end;
$$;

create or replace function public.main_office_upsert_directory(
  p_entity_type text,
  p_code text,
  p_name text,
  p_phone text default null,
  p_owner_id uuid default null,
  p_plate_number text default null,
  p_notes text default null,
  p_is_active boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_id uuid;
  v_office_id uuid;
  v_branch_count integer;
begin
  v_actor := public.current_main_office_user();

  select count(*) into v_branch_count
  from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true;
  if v_branch_count <> 1 then
    raise exception 'RAS_SEDR_BRANCH_CONFIGURATION_INVALID';
  end if;
  select office_id into v_office_id from public.offices
  where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true;

  if nullif(trim(p_code),'') is null or nullif(trim(p_name),'') is null then
    raise exception 'CODE_AND_NAME_REQUIRED';
  end if;

  case upper(p_entity_type)
  when 'FACTORY' then
    insert into public.factories(factory_code,name,notes,is_active)
    values(trim(p_code),trim(p_name),p_notes,p_is_active)
    returning factory_id into v_id;
  when 'QUARRY' then
    insert into public.quarries(quarry_code,name,notes,is_active)
    values(trim(p_code),trim(p_name),p_notes,p_is_active)
    returning quarry_id into v_id;
  when 'OWNER' then
    insert into public.vehicle_owners(owner_code,name,phone,notes,is_active)
    values(trim(p_code),trim(p_name),p_phone,p_notes,p_is_active)
    returning owner_id into v_id;
  when 'VEHICLE' then
    if nullif(trim(p_plate_number),'') is null then raise exception 'PLATE_NUMBER_REQUIRED'; end if;
    insert into public.vehicles(vehicle_code,plate_number,owner_id,office_id,notes,is_active)
    values(trim(p_code),trim(p_plate_number),p_owner_id,v_office_id,p_notes,p_is_active)
    returning vehicle_id into v_id;
  when 'DRIVER' then
    insert into public.drivers(driver_code,name,phone,office_id,is_active)
    values(trim(p_code),trim(p_name),p_phone,v_office_id,p_is_active)
    returning driver_id into v_id;
  else
    raise exception 'UNSUPPORTED_ENTITY_TYPE';
  end case;

  perform public.write_audit_event('CREATE_'||upper(p_entity_type),upper(p_entity_type),v_id,
    jsonb_build_object('code',trim(p_code),'name',trim(p_name),'is_active',p_is_active));
  return jsonb_build_object('id',v_id,'entity_type',upper(p_entity_type),'code',trim(p_code),'name',trim(p_name),'is_active',p_is_active);
end;
$$;

create or replace function public.main_office_set_directory_active(
  p_entity_type text, p_entity_id uuid, p_is_active boolean
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_actor uuid; v_rows integer;
begin
  v_actor := public.current_main_office_user();
  if p_entity_id is null or p_is_active is null then raise exception 'ENTITY_AND_ACTIVE_FLAG_REQUIRED'; end if;
  case upper(p_entity_type)
    when 'FACTORY' then update public.factories set is_active=p_is_active,updated_at=now() where factory_id=p_entity_id;
    when 'QUARRY' then update public.quarries set is_active=p_is_active,updated_at=now() where quarry_id=p_entity_id;
    when 'OWNER' then update public.vehicle_owners set is_active=p_is_active,updated_at=now() where owner_id=p_entity_id;
    when 'VEHICLE' then update public.vehicles set is_active=p_is_active,updated_at=now() where vehicle_id=p_entity_id;
    when 'DRIVER' then update public.drivers set is_active=p_is_active,updated_at=now() where driver_id=p_entity_id;
    else raise exception 'UNSUPPORTED_ENTITY_TYPE';
  end case;
  get diagnostics v_rows = row_count;
  if v_rows=0 then raise exception 'ENTITY_NOT_FOUND'; end if;
  perform public.write_audit_event(case when p_is_active then 'ACTIVATE_' else 'DEACTIVATE_' end||upper(p_entity_type),upper(p_entity_type),p_entity_id,jsonb_build_object('is_active',p_is_active));
  return jsonb_build_object('id',p_entity_id,'entity_type',upper(p_entity_type),'is_active',p_is_active);
end;
$$;

create or replace function public.main_office_create_load_order(
  p_factory_id uuid, p_quarry_id uuid, p_requested_quantity integer, p_priority integer default 3, p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_actor uuid; v_id uuid;
begin
  v_actor := public.current_main_office_user();
  if p_requested_quantity is null or p_requested_quantity<=0 then raise exception 'INVALID_REQUESTED_QUANTITY'; end if;
  if p_priority is null or p_priority not between 1 and 5 then raise exception 'INVALID_PRIORITY'; end if;
  if not exists(select 1 from public.factories where factory_id=p_factory_id and is_active) then raise exception 'FACTORY_NOT_ACTIVE'; end if;
  if not exists(select 1 from public.quarries where quarry_id=p_quarry_id and is_active) then raise exception 'QUARRY_NOT_ACTIVE'; end if;
  insert into public.load_orders(factory_id,quarry_id,created_by,requested_quantity,priority,notes,status)
  values(p_factory_id,p_quarry_id,v_actor,p_requested_quantity,p_priority,p_notes,'DRAFT')
  returning load_order_id into v_id;
  perform public.write_audit_event('CREATE_LOAD_ORDER','LOAD_ORDER',v_id,
    jsonb_build_object('factory_id',p_factory_id,'quarry_id',p_quarry_id,'requested_quantity',p_requested_quantity,'priority',p_priority));
  return jsonb_build_object('load_order_id',v_id,'status','DRAFT');
end;
$$;

create or replace function public.main_office_publish_load_order(p_load_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_actor uuid; v_order public.load_orders%rowtype;
begin
  v_actor := public.current_main_office_user();
  select * into v_order from public.load_orders where load_order_id=p_load_order_id for update;
  if not found then raise exception 'LOAD_ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'DRAFT' then raise exception 'LOAD_ORDER_NOT_DRAFT'; end if;
  update public.load_orders set status='PUBLISHED',published_at=now(),updated_at=now() where load_order_id=p_load_order_id;
  perform public.write_audit_event('PUBLISH_LOAD_ORDER','LOAD_ORDER',p_load_order_id,'{}'::jsonb);
  return jsonb_build_object('load_order_id',p_load_order_id,'status','PUBLISHED');
end;
$$;

revoke all on function public.current_main_office_user() from public, anon, authenticated;
revoke all on function public.write_audit_event(text,text,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.main_office_upsert_directory(text,text,text,text,uuid,text,text,boolean) from public, anon, authenticated;
revoke all on function public.main_office_set_directory_active(text,uuid,boolean) from public, anon, authenticated;
revoke all on function public.main_office_create_load_order(uuid,uuid,integer,integer,text) from public, anon, authenticated;
revoke all on function public.main_office_publish_load_order(uuid) from public, anon, authenticated;

grant execute on function public.current_main_office_user() to authenticated;
grant execute on function public.main_office_upsert_directory(text,text,text,text,uuid,text,text,boolean) to authenticated;
grant execute on function public.main_office_set_directory_active(text,uuid,boolean) to authenticated;
grant execute on function public.main_office_create_load_order(uuid,uuid,integer,integer,text) to authenticated;
grant execute on function public.main_office_publish_load_order(uuid) to authenticated;
