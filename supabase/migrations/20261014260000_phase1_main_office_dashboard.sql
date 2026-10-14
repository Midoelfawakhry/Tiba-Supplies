create or replace function public.main_office_get_dashboard()
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare v_actor uuid;
begin
 v_actor:=public.current_main_office_user();
 return jsonb_build_object(
  'office',(select jsonb_build_object('office_id',office_id,'office_code',office_code,'name',name,'office_type',office_type,'latitude',latitude,'longitude',longitude,'geofence_radius_m',geofence_radius_m) from public.offices where office_code='MAIN' and office_type='HEAD_OFFICE' and is_active=true),
  'operational_office',(select jsonb_build_object('office_id',office_id,'office_code',office_code,'name',name,'office_type',office_type) from public.offices where office_code='MAIN' and office_type='HEAD_OFFICE' and is_active=true),
  'check_in_office',(select jsonb_build_object('office_id',office_id,'office_code',office_code,'name',name,'office_type',office_type,'latitude',latitude,'longitude',longitude,'geofence_radius_m',geofence_radius_m) from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true),
  'factories',(select coalesce(jsonb_agg(jsonb_build_object('factory_id',factory_id,'factory_code',factory_code,'name',name,'is_active',is_active) order by name),'[]'::jsonb) from public.factories),
  'quarries',(select coalesce(jsonb_agg(jsonb_build_object('quarry_id',quarry_id,'quarry_code',quarry_code,'name',name,'latitude',latitude,'longitude',longitude,'is_active',is_active) order by name),'[]'::jsonb) from public.quarries),
  'drivers',(select coalesce(jsonb_agg(jsonb_build_object('driver_id',d.driver_id,'driver_code',d.driver_code,'name',d.name,'phone',d.phone,'office_id',d.office_id,'is_active',d.is_active,'latitude',l.latitude,'longitude',l.longitude,'location_captured_at',l.captured_at,'location_received_at',l.received_at) order by d.name),'[]'::jsonb) from public.drivers d left join public.driver_live_locations l on l.driver_id=d.driver_id),
  'vehicles',(select coalesce(jsonb_agg(jsonb_build_object('vehicle_id',v.vehicle_id,'vehicle_code',v.vehicle_code,'plate_number',v.plate_number,'owner_id',v.owner_id,'office_id',v.office_id,'is_active',v.is_active) order by v.plate_number),'[]'::jsonb) from public.vehicles v),
  'load_orders',(select coalesce(jsonb_agg(jsonb_build_object('load_order_id',lo.load_order_id,'order_number',lo.order_number,'factory_id',lo.factory_id,'factory_name',f.name,'quarry_id',lo.quarry_id,'quarry_name',q.name,'requested_quantity',lo.requested_quantity,'priority',lo.priority,'status',lo.status,'created_at',lo.created_at,'published_at',lo.published_at,'notes',lo.notes) order by lo.created_at desc),'[]'::jsonb) from public.load_orders lo join public.factories f on f.factory_id=lo.factory_id join public.quarries q on q.quarry_id=lo.quarry_id),
  'bookings',(select coalesce(jsonb_agg(jsonb_build_object('booking_id',b.booking_id,'load_order_id',b.load_order_id,'driver_id',b.driver_id,'driver_name',d.name,'vehicle_id',b.vehicle_id,'plate_number',v.plate_number,'assignment_type',b.assignment_type,'status',b.status,'trip_code',b.trip_code,'assigned_at',b.assigned_at,'arrived_at',b.arrived_at) order by b.assigned_at desc),'[]'::jsonb) from public.bookings b join public.drivers d on d.driver_id=b.driver_id join public.vehicles v on v.vehicle_id=b.vehicle_id),
  'actual_loading_records',(select coalesce(jsonb_agg(jsonb_build_object('actual_load_id',a.actual_load_id,'booking_id',a.booking_id,'actual_weight',a.actual_weight,'ticket_number',a.ticket_number,'loaded_at',a.loaded_at,'notes',a.notes) order by a.loaded_at desc),'[]'::jsonb) from public.actual_loading_records a)
 );
end;
$$;
revoke all on function public.main_office_get_dashboard() from public,anon,authenticated;
grant execute on function public.main_office_get_dashboard() to authenticated;