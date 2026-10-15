-- Preserve existing owner notes when the directory UI edits only name/phone.
-- A non-null empty string explicitly clears notes; null means leave them unchanged.
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
  v_notes text;
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

  v_notes := case
    when p_notes is null then v_owner.notes
    else nullif(trim(p_notes), '')
  end;

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
notify pgrst, 'reload schema';
