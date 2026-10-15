-- Show each driver's selected route in the Main Office waiting-list view.
create or replace function public.get_office_waiting_list()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_uid uuid:=auth.uid(); v_role text; v_office public.offices%rowtype; v_window public.dispatch_windows%rowtype;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select role into v_role from public.app_users where auth_user_id=v_uid and is_active=true limit 1;
 if v_role is null or v_role not in ('ADMIN','HEAD_OFFICE','BRANCH') then raise exception 'INSUFFICIENT_ROLE'; end if;
 select * into v_office from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true;
 select * into v_window from public.dispatch_windows where office_id=v_office.office_id order by opened_at desc limit 1;
 return jsonb_build_object(
  'office_id',v_office.office_id,
  'selection_window',case when v_window.dispatch_window_id is null then null else jsonb_build_object('dispatch_window_id',v_window.dispatch_window_id,'status',v_window.status,'opened_at',v_window.opened_at,'selection_ends_at',v_window.selection_ends_at,'closed_at',v_window.closed_at) end,
  'entries',coalesce((select jsonb_agg(jsonb_build_object(
    'entry_id',w.entry_id,'driver_id',w.driver_id,'driver_name',d.name,'driver_code',d.driver_code,'driver_phone',d.phone,
    'arrived_at',w.arrived_at,'status',w.status,'queue_position',x.position,'last_check_in_at',w.last_check_in_at,
    'selected_load_order_id',c.load_order_id,'selected_factory_name',sf.name,'selected_quarry_name',sq.name,
    'choice_status',c.status,'chosen_at',c.chosen_at,'trip_code',b.trip_code,'booking_id',b.booking_id,
    'vehicle_id',veh.vehicle_id,'plate_number',veh.plate_number)
    order by w.arrived_at,w.entry_id)
   from public.waiting_list_entries w join public.drivers d on d.driver_id=w.driver_id
   left join lateral(select count(*)::integer+1 position from public.waiting_list_entries p where p.office_id=w.office_id and p.status='WAITING' and (p.arrived_at<w.arrived_at or (p.arrived_at=w.arrived_at and p.entry_id<w.entry_id))) x on true
   left join public.driver_load_choices c on c.queue_entry_id=w.entry_id and c.dispatch_window_id=v_window.dispatch_window_id
   left join public.load_orders selected_order on selected_order.load_order_id=c.load_order_id
   left join public.factories sf on sf.factory_id=selected_order.factory_id
   left join public.quarries sq on sq.quarry_id=selected_order.quarry_id
   left join public.bookings b on b.booking_id=c.assigned_booking_id
   left join lateral(select v.vehicle_id,v.plate_number from public.driver_vehicle_assignments a join public.vehicles v on v.vehicle_id=a.vehicle_id and v.is_active=true where a.driver_id=d.driver_id and a.ended_at is null order by a.created_at desc limit 1) veh on true
   where w.office_id=v_office.office_id and w.status in ('WAITING','ASSIGNED')),'[]'::jsonb));
end; $$;
notify pgrst,'reload schema';