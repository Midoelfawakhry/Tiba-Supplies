-- Expose in-app notifications for the queue selection and final allocation workflow.
create or replace function public.driver_get_dispatch_state()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 v_driver public.drivers%rowtype; v_office public.offices%rowtype; v_location public.driver_live_locations%rowtype;
 v_entry public.waiting_list_entries%rowtype; v_window public.dispatch_windows%rowtype; v_choice public.driver_load_choices%rowtype;
 v_distance_m double precision; v_inside boolean:=false; v_position integer;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select * into v_driver from public.drivers where auth_user_id=auth.uid() and is_active=true;
 if not found then raise exception 'DRIVER_NOT_FOUND' using errcode='42501'; end if;
 select * into v_office from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true;
 if not found or v_office.latitude is null or v_office.longitude is null then raise exception 'RAS_SEDR_GEOFENCE_NOT_CONFIGURED'; end if;
 select * into v_location from public.driver_live_locations where driver_id=v_driver.driver_id;
 if found and v_location.captured_at>=now()-interval '10 minutes' and v_location.captured_at<=now()+interval '1 minute' and v_location.accuracy_m is not null and v_location.accuracy_m<=100 then
  v_distance_m:=6371000*2*asin(sqrt(least(1,greatest(0,power(sin(radians(v_location.latitude-v_office.latitude)/2),2)+cos(radians(v_office.latitude))*cos(radians(v_location.latitude))*power(sin(radians(v_location.longitude-v_office.longitude)/2),2)))));
  v_inside:=v_distance_m<=coalesce(v_office.geofence_radius_m,10000);
 end if;
 select * into v_entry from public.waiting_list_entries where driver_id=v_driver.driver_id and office_id=v_office.office_id and status='WAITING' order by arrived_at desc limit 1;
 if found then select count(*)::integer+1 into v_position from public.waiting_list_entries w where w.office_id=v_office.office_id and w.status='WAITING' and (w.arrived_at<v_entry.arrived_at or (w.arrived_at=v_entry.arrived_at and w.entry_id<v_entry.entry_id)); end if;
 select * into v_window from public.dispatch_windows where office_id=v_office.office_id order by opened_at desc limit 1;
 select * into v_choice from public.driver_load_choices c where c.driver_id=v_driver.driver_id and c.dispatch_window_id=v_window.dispatch_window_id order by c.chosen_at desc limit 1;
 return jsonb_build_object(
  'inside_geofence',v_inside,'distance_m',v_distance_m,'radius_m',coalesce(v_office.geofence_radius_m,10000),
  'location_updated_at',v_location.captured_at,'office_name',v_office.name,
  'queue_status',case when not v_inside then 'OUTSIDE' when v_entry.entry_id is not null then 'WAITING' when exists(select 1 from public.waiting_list_entries w where w.driver_id=v_driver.driver_id and w.office_id=v_office.office_id and w.status='ASSIGNED' and w.assigned_at>now()-interval '1 day') then 'ASSIGNED' else 'NOT_REGISTERED' end,
  'queue_position',v_position,'queue_arrived_at',v_entry.arrived_at,
  'selection_window',case when v_window.dispatch_window_id is null then null else jsonb_build_object('dispatch_window_id',v_window.dispatch_window_id,'status',v_window.status,'opened_at',v_window.opened_at,'selection_ends_at',v_window.selection_ends_at,'closed_at',v_window.closed_at,'is_open',v_window.status='OPEN' and now()<v_window.selection_ends_at) end,
  'selected_load_order_id',v_choice.load_order_id,'choice_status',v_choice.status,'chosen_at',v_choice.chosen_at,
  'available_loads',case when v_inside and v_entry.entry_id is not null and v_window.status='OPEN' and now()<v_window.selection_ends_at then coalesce((select jsonb_agg(jsonb_build_object('load_order_id',lo.load_order_id,'order_number',lo.order_number,'factory_name',f.name,'quarry_name',q.name,'factory_id',f.factory_id,'quarry_id',q.quarry_id,'requested_quantity',lo.requested_quantity,'committed_quantity',(select count(*) from public.bookings b where b.load_order_id=lo.load_order_id and b.status<>'CANCELLED'),'remaining_quantity',greatest(0,lo.requested_quantity-(select count(*) from public.bookings b where b.load_order_id=lo.load_order_id and b.status<>'CANCELLED')),'priority',lo.priority,'status',lo.status,'selection_ends_at',v_window.selection_ends_at,'is_selected',v_choice.load_order_id=lo.load_order_id and v_choice.status='CHOSEN') order by lo.priority asc,lo.created_at asc) from public.load_orders lo join public.factories f on f.factory_id=lo.factory_id join public.quarries q on q.quarry_id=lo.quarry_id where lo.dispatch_window_id=v_window.dispatch_window_id and lo.status in ('PUBLISHED','IN_PROGRESS') and (select count(*) from public.bookings b where b.load_order_id=lo.load_order_id and b.status<>'CANCELLED')<lo.requested_quantity),'[]'::jsonb) else '[]'::jsonb end,
  'notifications',coalesce((select jsonb_agg(jsonb_build_object('notification_id',n.notification_id,'notification_type',n.notification_type,'title',n.title,'body',n.body,'created_at',n.created_at,'payload',n.payload) order by n.created_at desc) from (select * from public.notifications where recipient_driver_id=v_driver.driver_id and notification_type in ('LOAD_SELECTION_OPEN','LOAD_REQUEST_ACCEPTED') and created_at>=now()-interval '24 hours' order by created_at desc limit 5) n),'[]'::jsonb)
 );
end; $$;
revoke all on function public.driver_get_dispatch_state() from public,anon;
grant execute on function public.driver_get_dispatch_state() to authenticated;
notify pgrst,'reload schema';