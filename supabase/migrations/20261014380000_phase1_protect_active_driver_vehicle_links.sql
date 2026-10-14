create or replace function public.main_office_set_directory_active(
  p_entity_type text, p_entity_id uuid, p_is_active boolean
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid; v_rows integer; v_type text:=upper(trim(coalesce(p_entity_type,'')));
begin
 v_actor:=public.current_main_office_user();
 if p_entity_id is null or p_is_active is null then raise exception 'ENTITY_AND_ACTIVE_FLAG_REQUIRED'; end if;
 if not p_is_active and v_type='DRIVER' and exists(select 1 from public.bookings where driver_id=p_entity_id and status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT')) then raise exception 'DRIVER_HAS_ACTIVE_BOOKING'; end if;
 if not p_is_active and v_type='VEHICLE' and exists(select 1 from public.bookings where vehicle_id=p_entity_id and status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT')) then raise exception 'VEHICLE_HAS_ACTIVE_BOOKING'; end if;
 if not p_is_active and v_type='VEHICLE' and exists(select 1 from public.driver_vehicle_assignments where vehicle_id=p_entity_id and ended_at is null) then raise exception 'VEHICLE_HAS_ACTIVE_DRIVER'; end if;
 if not p_is_active and v_type='OWNER' and exists(select 1 from public.vehicles where owner_id=p_entity_id and is_active=true) then raise exception 'OWNER_HAS_ACTIVE_VEHICLES'; end if;
 case v_type
  when 'FACTORY' then update public.factories set is_active=p_is_active,updated_at=now() where factory_id=p_entity_id;
  when 'QUARRY' then update public.quarries set is_active=p_is_active,updated_at=now() where quarry_id=p_entity_id;
  when 'OWNER' then update public.vehicle_owners set is_active=p_is_active,updated_at=now() where owner_id=p_entity_id;
  when 'VEHICLE' then update public.vehicles set is_active=p_is_active,updated_at=now() where vehicle_id=p_entity_id;
  when 'DRIVER' then update public.drivers set is_active=p_is_active,updated_at=now() where driver_id=p_entity_id;
  else raise exception 'UNSUPPORTED_ENTITY_TYPE';
 end case;
 get diagnostics v_rows=row_count;
 if v_rows=0 then raise exception 'ENTITY_NOT_FOUND'; end if;
 perform public.write_audit_event(case when p_is_active then 'ACTIVATE_' else 'DEACTIVATE_' end||v_type,v_type,p_entity_id,jsonb_build_object('is_active',p_is_active));
 return jsonb_build_object('id',p_entity_id,'entity_type',v_type,'is_active',p_is_active);
end $$;
revoke all on function public.main_office_set_directory_active(text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.main_office_set_directory_active(text,uuid,boolean) to authenticated;