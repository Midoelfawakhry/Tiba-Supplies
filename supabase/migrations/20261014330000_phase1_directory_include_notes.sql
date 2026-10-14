-- Include editable notes in the Phase 1 directory response so edits round-trip.
create or replace function public.main_office_get_directory()
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare v_actor uuid;
begin
 v_actor:=public.current_main_office_user();
 return jsonb_build_object(
  'factories',(select coalesce(jsonb_agg(jsonb_build_object('id',factory_id,'code',factory_code,'name',name,'notes',notes,'is_active',is_active) order by name),'[]'::jsonb) from public.factories),
  'quarries',(select coalesce(jsonb_agg(jsonb_build_object('id',quarry_id,'code',quarry_code,'name',name,'notes',notes,'is_active',is_active,'latitude',latitude,'longitude',longitude) order by name),'[]'::jsonb) from public.quarries),
  'owners',(select coalesce(jsonb_agg(jsonb_build_object('id',owner_id,'code',owner_code,'name',name,'phone',phone,'is_active',is_active) order by name),'[]'::jsonb) from public.vehicle_owners),
  'vehicles',(select coalesce(jsonb_agg(jsonb_build_object('id',vehicle_id,'code',vehicle_code,'plate_number',plate_number,'owner_id',owner_id,'office_id',office_id,'is_active',is_active) order by plate_number),'[]'::jsonb) from public.vehicles),
  'drivers',(select coalesce(jsonb_agg(jsonb_build_object('id',driver_id,'code',driver_code,'name',name,'phone',phone,'office_id',office_id,'is_active',is_active) order by name),'[]'::jsonb) from public.drivers)
 );
end;
$$;
revoke all on function public.main_office_get_directory() from public,anon,authenticated;
grant execute on function public.main_office_get_directory() to authenticated;
