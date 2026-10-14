create sequence if not exists public.driver_code_seq start 1;

create or replace function public.main_office_create_driver(p_name text,p_phone text,p_driver_code text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid; v_office uuid; v_id uuid; v_code text; v_name text:=trim(coalesce(p_name,'')); v_phone text:=trim(coalesce(p_phone,''));
begin
 v_actor:=public.current_main_office_user();
 if v_name='' or v_phone='' then raise exception 'DRIVER_NAME_AND_PHONE_REQUIRED'; end if;
 if v_phone !~ '^(01[0125][0-9]{8}|\+?20(10|11|12|15)[0-9]{8}|00?20(10|11|12|15)[0-9]{8})$' then raise exception 'DRIVER_PHONE_INVALID'; end if;
 if exists(select 1 from public.drivers d where regexp_replace(coalesce(d.phone,''),'[^0-9]','','g')=regexp_replace(v_phone,'[^0-9]','','g')) then raise exception 'DRIVER_PHONE_EXISTS'; end if;
 select office_id into v_office from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active;
 if v_office is null then raise exception 'RAS_SEDR_BRANCH_CONFIGURATION_INVALID'; end if;
 v_code:=coalesce(nullif(trim(coalesce(p_driver_code,'')),''),'DR-'||lpad(nextval('public.driver_code_seq')::text,6,'0'));
 insert into public.drivers(driver_code,name,phone,office_id,is_active) values(v_code,v_name,v_phone,v_office,true) returning driver_id into v_id;
 perform public.write_audit_event('CREATE_DRIVER','DRIVER',v_id,jsonb_build_object('driver_code',v_code,'name',v_name,'phone',v_phone));
 return jsonb_build_object('success',true,'driver_id',v_id,'driver_code',v_code,'name',v_name,'phone',v_phone);
end $$;

create or replace function public.main_office_update_driver(p_driver_id uuid,p_name text,p_phone text,p_driver_code text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid; v_driver public.drivers%rowtype; v_name text:=trim(coalesce(p_name,'')); v_phone text:=trim(coalesce(p_phone,''));
begin
 v_actor:=public.current_main_office_user();
 if p_driver_id is null or v_name='' or v_phone='' then raise exception 'DRIVER_ID_NAME_PHONE_REQUIRED'; end if;
 if v_phone !~ '^(01[0125][0-9]{8}|\+?20(10|11|12|15)[0-9]{8}|00?20(10|11|12|15)[0-9]{8})$' then raise exception 'DRIVER_PHONE_INVALID'; end if;
 select * into v_driver from public.drivers where driver_id=p_driver_id for update;
 if not found then raise exception 'DRIVER_NOT_FOUND'; end if;
 if v_driver.auth_user_id is not null and v_phone is distinct from v_driver.phone then raise exception 'DRIVER_LOGIN_PHONE_CHANGE_REQUIRES_ACCOUNT_UPDATE'; end if;
 if exists(select 1 from public.drivers d where d.driver_id<>p_driver_id and regexp_replace(coalesce(d.phone,''),'[^0-9]','','g')=regexp_replace(v_phone,'[^0-9]','','g')) then raise exception 'DRIVER_PHONE_EXISTS'; end if;
 update public.drivers set name=v_name,phone=v_phone,driver_code=coalesce(nullif(trim(coalesce(p_driver_code,'')),''),driver_code),updated_at=now() where driver_id=p_driver_id;
 perform public.write_audit_event('UPDATE_DRIVER','DRIVER',p_driver_id,jsonb_build_object('name',v_name,'phone',v_phone,'driver_code',coalesce(nullif(trim(coalesce(p_driver_code,'')),''),v_driver.driver_code)));
 return jsonb_build_object('success',true,'driver_id',p_driver_id);
end $$;

create or replace function public.main_office_update_vehicle(p_vehicle_id uuid,p_plate_number text,p_owner_id uuid,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid; v_vehicle public.vehicles%rowtype; v_plate text:=trim(coalesce(p_plate_number,''));
begin
 v_actor:=public.current_main_office_user();
 if p_vehicle_id is null or v_plate='' or p_owner_id is null then raise exception 'VEHICLE_ID_PLATE_OWNER_REQUIRED'; end if;
 select * into v_vehicle from public.vehicles where vehicle_id=p_vehicle_id for update;
 if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;
 if exists(select 1 from public.bookings where vehicle_id=p_vehicle_id and status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT')) then raise exception 'VEHICLE_HAS_ACTIVE_BOOKING'; end if;
 if not exists(select 1 from public.vehicle_owners where owner_id=p_owner_id and is_active) then raise exception 'OWNER_NOT_ACTIVE'; end if;
 if exists(select 1 from public.vehicles where plate_number=v_plate and vehicle_id<>p_vehicle_id) then raise exception 'VEHICLE_PLATE_EXISTS'; end if;
 update public.vehicles set plate_number=v_plate,owner_id=p_owner_id,notes=nullif(trim(coalesce(p_notes,'')),''),updated_at=now() where vehicle_id=p_vehicle_id;
 perform public.write_audit_event('UPDATE_VEHICLE','VEHICLE',p_vehicle_id,jsonb_build_object('plate_number',v_plate,'owner_id',p_owner_id));
 return jsonb_build_object('success',true,'vehicle_id',p_vehicle_id,'vehicle_code',v_vehicle.vehicle_code);
end $$;

revoke all on function public.main_office_create_driver(text,text,text) from public,anon,authenticated;
revoke all on function public.main_office_update_driver(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.main_office_update_vehicle(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.main_office_create_driver(text,text,text) to authenticated;
grant execute on function public.main_office_update_driver(uuid,text,text,text) to authenticated;
grant execute on function public.main_office_update_vehicle(uuid,text,uuid,text) to authenticated;
