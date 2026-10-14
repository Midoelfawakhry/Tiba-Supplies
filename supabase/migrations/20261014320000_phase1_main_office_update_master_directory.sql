-- Controlled Main Office edits for the Phase 1 factory and quarry master directories.
create or replace function public.main_office_update_master_directory(
 p_entity_type text,p_entity_id uuid,p_code text,p_name text,p_notes text default null,p_is_active boolean default true
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
 v_actor uuid;
 v_type text:=upper(trim(coalesce(p_entity_type,'')));
 v_id uuid;
begin
 v_actor:=public.current_main_office_user();
 if v_type not in ('FACTORY','QUARRY') then raise exception 'UNSUPPORTED_MASTER_ENTITY_TYPE'; end if;
 if p_entity_id is null then raise exception 'ENTITY_ID_REQUIRED'; end if;
 if nullif(trim(coalesce(p_code,'')),'') is null or nullif(trim(coalesce(p_name,'')),'') is null then raise exception 'CODE_AND_NAME_REQUIRED'; end if;
 if v_type='FACTORY' then
  update public.factories set factory_code=trim(p_code),name=trim(p_name),notes=nullif(trim(coalesce(p_notes,'')),''),is_active=p_is_active,updated_at=now()
  where factory_id=p_entity_id returning factory_id into v_id;
 else
  update public.quarries set quarry_code=trim(p_code),name=trim(p_name),notes=nullif(trim(coalesce(p_notes,'')),''),is_active=p_is_active,updated_at=now()
  where quarry_id=p_entity_id returning quarry_id into v_id;
 end if;
 if v_id is null then raise exception 'DIRECTORY_ENTITY_NOT_FOUND'; end if;
 perform public.write_audit_event('UPDATE_'||v_type,v_type,v_id,jsonb_build_object('code',trim(p_code),'name',trim(p_name),'is_active',p_is_active));
 return jsonb_build_object('success',true,'entity_id',v_id,'entity_type',v_type,'is_active',p_is_active);
end;
$$;
revoke all on function public.main_office_update_master_directory(text,uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.main_office_update_master_directory(text,uuid,text,text,text,boolean) to authenticated;
