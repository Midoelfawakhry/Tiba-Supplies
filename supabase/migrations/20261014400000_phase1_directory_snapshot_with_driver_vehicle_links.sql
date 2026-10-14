-- Final Phase 1 directory snapshot includes active driver/vehicle links and preserves notes.
create or replace function public.main_office_get_directory()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid;
begin
 v_actor:=public.current_main_office_user();
 return jsonb_build_object(
  'factories',(select coalesce(jsonb_agg(jsonb_build_object('id',factory_id,'code',factory_code,'name',name,'notes',notes,'is_active',is_active) order by name),'[]'::jsonb) from public.factories),
  'quarries',(select coalesce(jsonb_agg(jsonb_build_object('id',quarry_id,'code',quarry_code,'name',name,'notes',notes,'is_active',is_active,'latitude',latitude,'longitude',longitude) order by name),'[]'::jsonb) from public.quarries),
  'owners',(select coalesce(jsonb_agg(jsonb_build_object('id',owner_id,'code',owner_code,'name',name,'phone',phone,'notes',notes,'is_active',is_active) order by name),'[]'::jsonb) from public.vehicle_owners),
  'vehicles',(select coalesce(jsonb_agg(jsonb_build_object('id',v.vehicle_id,'code',v.vehicle_code,'plate_number',v.plate_number,'owner_id',v.owner_id,'office_id',v.office_id,'notes',v.notes,'is_active',v.is_active,'assigned_driver_id',d.driver_id,'assigned_driver_name',d.name) order by v.plate_number),'[]'::jsonb) from public.vehicles v left join public.driver_vehicle_assignments a on a.vehicle_id=v.vehicle_id and a.ended_at is null left join public.drivers d on d.driver_id=a.driver_id),
  'drivers',(select coalesce(jsonb_agg(jsonb_build_object('id',d.driver_id,'code',d.driver_code,'name',d.name,'phone',d.phone,'office_id',d.office_id,'is_active',d.is_active,'vehicle_id',a.vehicle_id,'vehicle_code',v.vehicle_code,'plate_number',v.plate_number) order by d.name),'[]'::jsonb) from public.drivers d left join public.driver_vehicle_assignments a on a.driver_id=d.driver_id and a.ended_at is null left join public.vehicles v on v.vehicle_id=a.vehicle_id)
 );
end $$;
revoke all on function public.main_office_get_directory() from public,anon,authenticated;
grant execute on function public.main_office_get_directory() to authenticated;