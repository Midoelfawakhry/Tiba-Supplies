-- Main Office creates owners independently; vehicle codes are generated server-side.
create sequence if not exists public.vehicle_code_seq start 1;
create sequence if not exists public.vehicle_owner_code_seq start 1;

create or replace function public.main_office_create_vehicle(p_plate_number text,p_owner_id uuid,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid; v_office uuid; v_id uuid; v_code text; v_plate text:=trim(coalesce(p_plate_number,''));
begin
 v_actor:=public.current_main_office_user();
 if v_plate='' or p_owner_id is null then raise exception 'PLATE_AND_OWNER_REQUIRED'; end if;
 if not exists(select 1 from public.vehicle_owners where owner_id=p_owner_id and is_active) then raise exception 'OWNER_NOT_ACTIVE'; end if;
 select office_id into v_office from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true;
 if v_office is null then raise exception 'RAS_SEDR_BRANCH_CONFIGURATION_INVALID'; end if;
 v_code:='VH-'||lpad(nextval('public.vehicle_code_seq')::text,6,'0');
 insert into public.vehicles(vehicle_code,plate_number,owner_id,office_id,notes,is_active)
 values(v_code,v_plate,p_owner_id,v_office,nullif(trim(coalesce(p_notes,'')),''),true)
 returning vehicle_id into v_id;
 perform public.write_audit_event('CREATE_VEHICLE','VEHICLE',v_id,jsonb_build_object('vehicle_code',v_code,'plate_number',v_plate,'owner_id',p_owner_id));
 return jsonb_build_object('success',true,'vehicle_id',v_id,'vehicle_code',v_code,'plate_number',v_plate,'owner_id',p_owner_id);
end $$;

create or replace function public.main_office_create_vehicle_owner(p_name text,p_phone text default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid; v_id uuid; v_code text; v_name text:=trim(coalesce(p_name,''));
begin
 v_actor:=public.current_main_office_user();
 if v_name='' then raise exception 'OWNER_NAME_REQUIRED'; end if;
 v_code:='OW-'||lpad(nextval('public.vehicle_owner_code_seq')::text,6,'0');
 insert into public.vehicle_owners(owner_code,name,phone,notes,is_active)
 values(v_code,v_name,nullif(trim(coalesce(p_phone,'')),''),nullif(trim(coalesce(p_notes,'')),''),true)
 returning owner_id into v_id;
 perform public.write_audit_event('CREATE_OWNER','VEHICLE_OWNER',v_id,jsonb_build_object('owner_code',v_code,'name',v_name));
 return jsonb_build_object('success',true,'owner_id',v_id,'owner_code',v_code,'name',v_name);
end $$;

revoke all on function public.main_office_create_vehicle(text,uuid,text) from public,anon,authenticated;
revoke all on function public.main_office_create_vehicle_owner(text,text,text) from public,anon,authenticated;
grant execute on function public.main_office_create_vehicle(text,uuid,text) to authenticated;
grant execute on function public.main_office_create_vehicle_owner(text,text,text) to authenticated;
