-- Phase 1 driver portal: own-trip visibility and geofenced load discovery.
create or replace function public.driver_get_portal_snapshot()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_driver public.drivers%rowtype; v_office public.offices%rowtype; v_lat double precision; v_lon double precision; v_captured timestamptz; v_distance double precision; v_inside boolean:=false; v_fresh boolean:=false;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select * into v_driver from public.drivers where auth_user_id=auth.uid() and is_active=true;
 if not found then raise exception 'DRIVER_NOT_FOUND' using errcode='42501'; end if;
 select * into v_office from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true;
 if not found or v_office.latitude is null or v_office.longitude is null then raise exception 'OFFICE_LOCATION_NOT_CONFIGURED'; end if;
 select latitude,longitude,captured_at into v_lat,v_lon,v_captured from public.driver_live_locations where driver_id=v_driver.driver_id;
 if v_captured is not null then
  v_fresh:=v_captured>=now()-interval '10 minutes' and v_captured<=now()+interval '1 minute';
  v_distance:=6371000*2*asin(sqrt(least(1,greatest(0,power(sin(radians(v_lat-v_office.latitude)/2),2)+cos(radians(v_office.latitude))*cos(radians(v_lat))*power(sin(radians(v_lon-v_office.longitude)/2),2)))));
  v_inside:=v_fresh and v_distance<=v_office.geofence_radius_m;
 end if;
 return jsonb_build_object('driver_id',v_driver.driver_id,'driver_name',v_driver.name,'driver_code',v_driver.driver_code,'office_name',v_office.name,'distance_m',v_distance,'inside_geofence',v_inside,'location_updated_at',v_captured,'queue_status',null,'queue_position',null,
 'my_bookings',coalesce((select jsonb_agg(jsonb_build_object('booking_id',b.booking_id,'load_order_id',lo.load_order_id,'factory_name',f.name,'quarry_name',q.name,'trip_code',b.trip_code,'raw_status',b.status,'is_direct_assignment',(b.assignment_type='DIRECT'),'status',case b.status when 'ASSIGNED' then 'BOOKED' when 'ARRIVED' then 'BOOKED' when 'LOADING' then 'LOADING_STATEMENT' when 'LOADED' then 'LOADING_STATEMENT' when 'IN_TRANSIT' then 'IN_TRANSIT' when 'DELIVERED' then 'DELIVERED' else 'CANCELLED' end,'booked_at',b.assigned_at,'actual_weight',al.actual_weight,'ticket_number',al.ticket_number) order by b.assigned_at desc)
 from public.bookings b join public.load_orders lo on lo.load_order_id=b.load_order_id join public.factories f on f.factory_id=lo.factory_id join public.quarries q on q.quarry_id=lo.quarry_id left join public.actual_loading_records al on al.booking_id=b.booking_id where b.driver_id=v_driver.driver_id),'[]'::jsonb),
 'available_loads',case when v_inside then coalesce((select jsonb_agg(jsonb_build_object('load_order_id',lo.load_order_id,'factory_name',f.name,'quarry_name',q.name,'quarry_id',q.quarry_id,'requested_quantity',lo.requested_quantity,'remaining_quantity',greatest(0,lo.requested_quantity-coalesce(x.committed,0)),'priority',lo.priority,'status',lo.status) order by lo.priority asc,lo.created_at asc)
 from public.load_orders lo join public.factories f on f.factory_id=lo.factory_id join public.quarries q on q.quarry_id=lo.quarry_id left join lateral (select count(*)::integer committed from public.bookings b where b.load_order_id=lo.load_order_id and b.status<>'CANCELLED') x on true where lo.status='PUBLISHED' and greatest(0,lo.requested_quantity-coalesce(x.committed,0))>0),'[]'::jsonb) else '[]'::jsonb end);
end; $$;
create or replace function public.driver_get_pending_assignments()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_driver_id uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select driver_id into v_driver_id from public.drivers where auth_user_id=auth.uid() and is_active=true;
 if v_driver_id is null then raise exception 'DRIVER_NOT_FOUND' using errcode='42501'; end if;
 -- Assignments are active atomically in Phase 1; no second legacy acceptance step.
 return '[]'::jsonb;
end; $$;
revoke all on function public.driver_get_portal_snapshot() from public,anon,authenticated;
grant execute on function public.driver_get_portal_snapshot() to authenticated;
revoke all on function public.driver_get_pending_assignments() from public,anon,authenticated;
grant execute on function public.driver_get_pending_assignments() to authenticated;
