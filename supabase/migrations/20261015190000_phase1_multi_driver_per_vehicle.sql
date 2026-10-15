-- Allow multiple active driver assignments per vehicle while keeping one active vehicle per driver.
-- A vehicle still cannot have more than one active booking (bookings_one_active_vehicle).
drop index if exists public.driver_vehicle_one_active_vehicle;

create or replace function public.main_office_create_driver(p_name text,p_phone text,p_driver_code text,p_vehicle_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid; v_office uuid; v_id uuid; v_code text; v_name text:=trim(coalesce(p_name,'')); v_phone text:=trim(coalesce(p_phone,''));
begin
 v_actor:=public.current_main_office_user();
 if v_name='' or v_phone='' or p_vehicle_id is null then raise exception 'DRIVER_NAME_PHONE_AND_VEHICLE_REQUIRED'; end if;
 if v_phone !~ '^(01[0125][0-9]{8}|\\+?20(10|11|12|15)[0-9]{8}|00?20(10|11|12|15)[0-9]{8})$' then raise exception 'DRIVER_PHONE_INVALID'; end if;
 if exists(select 1 from public.drivers d where regexp_replace(coalesce(d.phone,''),'[^0-9]','','g')=regexp_replace(v_phone,'[^0-9]','','g')) then raise exception 'DRIVER_PHONE_EXISTS'; end if;
 if not exists(select 1 from public.vehicles where vehicle_id=p_vehicle_id and is_active) then raise exception 'VEHICLE_NOT_AVAILABLE'; end if;
 select office_id into v_office from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active;
 if v_office is null then raise exception 'RAS_SEDR_BRANCH_CONFIGURATION_INVALID'; end if;
 v_code:=coalesce(nullif(trim(coalesce(p_driver_code,'')),''),'DR-'||lpad(nextval('public.driver_code_seq')::text,6,'0'));
 insert into public.drivers(driver_code,name,phone,office_id,is_active) values(v_code,v_name,v_phone,v_office,true) returning driver_id into v_id;
 insert into public.driver_vehicle_assignments(driver_id,vehicle_id,assigned_by) values(v_id,p_vehicle_id,v_actor);
 perform public.write_audit_event('CREATE_DRIVER','DRIVER',v_id,jsonb_build_object('driver_code',v_code,'name',v_name,'phone',v_phone,'vehicle_id',p_vehicle_id));
 perform public.write_audit_event('ASSIGN_DRIVER_VEHICLE','DRIVER_VEHICLE_ASSIGNMENT',v_id,jsonb_build_object('vehicle_id',p_vehicle_id));
 return jsonb_build_object('success',true,'driver_id',v_id,'driver_code',v_code,'name',v_name,'phone',v_phone,'vehicle_id',p_vehicle_id);
end $$;

create or replace function public.main_office_update_driver(p_driver_id uuid,p_name text,p_phone text,p_driver_code text,p_vehicle_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid; v_driver public.drivers%rowtype; v_name text:=trim(coalesce(p_name,'')); v_phone text:=trim(coalesce(p_phone,'')); v_old_vehicle uuid;
begin
 v_actor:=public.current_main_office_user();
 if p_driver_id is null or v_name='' or v_phone='' or p_vehicle_id is null then raise exception 'DRIVER_ID_NAME_PHONE_AND_VEHICLE_REQUIRED'; end if;
 if v_phone !~ '^(01[0125][0-9]{8}|\\+?20(10|11|12|15)[0-9]{8}|00?20(10|11|12|15)[0-9]{8})$' then raise exception 'DRIVER_PHONE_INVALID'; end if;
 select * into v_driver from public.drivers where driver_id=p_driver_id for update;
 if not found then raise exception 'DRIVER_NOT_FOUND'; end if;
 if v_driver.auth_user_id is not null and v_phone is distinct from v_driver.phone then raise exception 'DRIVER_LOGIN_PHONE_CHANGE_REQUIRES_ACCOUNT_UPDATE'; end if;
 if exists(select 1 from public.drivers d where d.driver_id<>p_driver_id and regexp_replace(coalesce(d.phone,''),'[^0-9]','','g')=regexp_replace(v_phone,'[^0-9]','','g')) then raise exception 'DRIVER_PHONE_EXISTS'; end if;
 if not exists(select 1 from public.vehicles where vehicle_id=p_vehicle_id and is_active) then raise exception 'VEHICLE_NOT_AVAILABLE'; end if;
 select vehicle_id into v_old_vehicle from public.driver_vehicle_assignments where driver_id=p_driver_id and ended_at is null for update;
 if v_old_vehicle is distinct from p_vehicle_id then
   if exists(select 1 from public.bookings where driver_id=p_driver_id and status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT')) then raise exception 'DRIVER_HAS_ACTIVE_BOOKING'; end if;
   update public.driver_vehicle_assignments set ended_at=now() where driver_id=p_driver_id and ended_at is null;
   insert into public.driver_vehicle_assignments(driver_id,vehicle_id,assigned_by) values(p_driver_id,p_vehicle_id,v_actor);
   perform public.write_audit_event('REASSIGN_DRIVER_VEHICLE','DRIVER_VEHICLE_ASSIGNMENT',p_driver_id,jsonb_build_object('previous_vehicle_id',v_old_vehicle,'vehicle_id',p_vehicle_id));
 end if;
 update public.drivers set name=v_name,phone=v_phone,driver_code=coalesce(nullif(trim(coalesce(p_driver_code,'')),''),driver_code),updated_at=now() where driver_id=p_driver_id;
 perform public.write_audit_event('UPDATE_DRIVER','DRIVER',p_driver_id,jsonb_build_object('name',v_name,'phone',v_phone,'driver_code',coalesce(nullif(trim(coalesce(p_driver_code,'')),''),v_driver.driver_code)));
 return jsonb_build_object('success',true,'driver_id',p_driver_id,'vehicle_id',p_vehicle_id);
end $$;

create or replace function public.main_office_get_directory()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid;
begin
 v_actor:=public.current_main_office_user();
 return jsonb_build_object(
  'factories',(select coalesce(jsonb_agg(jsonb_build_object('id',factory_id,'code',factory_code,'name',name,'is_active',is_active) order by name),'[]'::jsonb) from public.factories),
  'quarries',(select coalesce(jsonb_agg(jsonb_build_object('id',quarry_id,'code',quarry_code,'name',name,'is_active',is_active,'latitude',latitude,'longitude',longitude) order by name),'[]'::jsonb) from public.quarries),
  'owners',(select coalesce(jsonb_agg(jsonb_build_object('id',owner_id,'code',owner_code,'name',name,'phone',phone,'is_active',is_active) order by name),'[]'::jsonb) from public.vehicle_owners),
  'vehicles',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',v.vehicle_id,'code',v.vehicle_code,'plate_number',v.plate_number,'owner_id',v.owner_id,'office_id',v.office_id,'is_active',v.is_active,
    'assigned_drivers',coalesce((select jsonb_agg(jsonb_build_object('id',d.driver_id,'name',d.name,'code',d.driver_code) order by d.name)
      from public.driver_vehicle_assignments a join public.drivers d on d.driver_id=a.driver_id
      where a.vehicle_id=v.vehicle_id and a.ended_at is null),'[]'::jsonb)
   ) order by v.plate_number),'[]'::jsonb) from public.vehicles v),
  'drivers',(select coalesce(jsonb_agg(jsonb_build_object('id',d.driver_id,'code',d.driver_code,'name',d.name,'phone',d.phone,'office_id',d.office_id,'is_active',d.is_active,'vehicle_id',a.vehicle_id,'vehicle_code',v.vehicle_code,'plate_number',v.plate_number) order by d.name),'[]'::jsonb) from public.drivers d left join public.driver_vehicle_assignments a on a.driver_id=d.driver_id and a.ended_at is null left join public.vehicles v on v.vehicle_id=a.vehicle_id)
 );
end $$;

revoke all on function public.main_office_create_driver(text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.main_office_update_driver(uuid,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.main_office_get_directory() from public,anon,authenticated;
grant execute on function public.main_office_create_driver(text,text,text,uuid) to authenticated;
grant execute on function public.main_office_update_driver(uuid,text,text,text,uuid) to authenticated;
grant execute on function public.main_office_get_directory() to authenticated;
