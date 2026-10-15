-- Queue UI and concurrent publication hardening for Phase 1 / Change 4.
create or replace function public.main_office_publish_load_order(p_load_order_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid; v_order public.load_orders%rowtype; v_office public.offices%rowtype; v_window public.dispatch_windows%rowtype; v_notified integer:=0;
begin
 v_actor:=public.current_main_office_user();
 perform public.finalize_expired_dispatch_windows();
 select * into v_order from public.load_orders where load_order_id=p_load_order_id for update;
 if not found then raise exception 'LOAD_ORDER_NOT_FOUND'; end if;
 if v_order.status<>'DRAFT' then raise exception 'LOAD_ORDER_NOT_DRAFT'; end if;
 select * into v_office from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true;
 if not found then raise exception 'RAS_SEDR_BRANCH_CONFIGURATION_INVALID'; end if;

 select * into v_window from public.dispatch_windows
 where office_id=v_office.office_id and status='OPEN' and selection_ends_at>now()
 order by opened_at desc limit 1 for update;
 if not found then
   insert into public.dispatch_windows(office_id,status,opened_at,selection_ends_at,created_by)
   values(v_office.office_id,'OPEN',now(),now()+interval '5 minutes',v_actor)
   on conflict (office_id) where status='OPEN' do nothing;
   select * into v_window from public.dispatch_windows
   where office_id=v_office.office_id and status='OPEN' and selection_ends_at>now()
   order by opened_at desc limit 1 for update;
 end if;
 if v_window.dispatch_window_id is null then raise exception 'DISPATCH_WINDOW_CREATION_FAILED'; end if;

 update public.load_orders set status='PUBLISHED',published_at=now(),dispatch_window_id=v_window.dispatch_window_id,updated_at=now()
 where load_order_id=p_load_order_id;
 insert into public.notifications(recipient_driver_id,notification_type,title,body,payload)
 select d.driver_id,'LOAD_SELECTION_OPEN','طلب تحميل متاح للاختيار','تم نشر طلب تحميل. اختار النقلة خلال نافذة الاختيار المحددة بخمس دقائق.',
  jsonb_build_object('load_order_id',p_load_order_id,'dispatch_window_id',v_window.dispatch_window_id,'selection_ends_at',v_window.selection_ends_at,'factory_id',v_order.factory_id,'quarry_id',v_order.quarry_id)
 from public.drivers d join public.driver_live_locations l on l.driver_id=d.driver_id
 where d.is_active=true and d.office_id=v_office.office_id
 and l.captured_at>=now()-interval '10 minutes' and l.captured_at<=now()+interval '1 minute'
 and l.accuracy_m is not null and l.accuracy_m<=100
 and 6371000*2*asin(sqrt(least(1,greatest(0,power(sin(radians(l.latitude-v_office.latitude)/2),2)+cos(radians(v_office.latitude))*cos(radians(l.latitude))*power(sin(radians(l.longitude-v_office.longitude)/2),2)))))<=coalesce(v_office.geofence_radius_m,10000)
 and exists(select 1 from public.waiting_list_entries w where w.driver_id=d.driver_id and w.office_id=v_office.office_id and w.status='WAITING')
 and exists(select 1 from public.driver_vehicle_assignments a join public.vehicles v on v.vehicle_id=a.vehicle_id where a.driver_id=d.driver_id and a.ended_at is null and v.is_active=true and v.office_id=v_office.office_id)
 and not exists(select 1 from public.bookings b where b.driver_id=d.driver_id and b.status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT'));
 get diagnostics v_notified=row_count;
 perform public.write_audit_event('PUBLISH_LOAD_ORDER','LOAD_ORDER',p_load_order_id,jsonb_build_object('dispatch_window_id',v_window.dispatch_window_id,'selection_ends_at',v_window.selection_ends_at,'eligible_drivers_notified',v_notified));
 return jsonb_build_object('load_order_id',p_load_order_id,'status','PUBLISHED','dispatch_window_id',v_window.dispatch_window_id,'selection_ends_at',v_window.selection_ends_at,'selection_window_seconds',300,'eligible_drivers_notified',v_notified);
end; $$;

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
    'selected_load_order_id',c.load_order_id,'choice_status',c.status,'chosen_at',c.chosen_at,
    'trip_code',b.trip_code,'booking_id',b.booking_id,'vehicle_id',veh.vehicle_id,'plate_number',veh.plate_number)
    order by w.arrived_at,w.entry_id)
   from public.waiting_list_entries w join public.drivers d on d.driver_id=w.driver_id
   left join lateral(select count(*)::integer+1 position from public.waiting_list_entries p where p.office_id=w.office_id and p.status='WAITING' and (p.arrived_at<w.arrived_at or (p.arrived_at=w.arrived_at and p.entry_id<w.entry_id))) x on true
   left join public.driver_load_choices c on c.queue_entry_id=w.entry_id and c.dispatch_window_id=v_window.dispatch_window_id
   left join public.bookings b on b.booking_id=c.assigned_booking_id
   left join lateral(select v.vehicle_id,v.plate_number from public.driver_vehicle_assignments a join public.vehicles v on v.vehicle_id=a.vehicle_id and v.is_active=true where a.driver_id=d.driver_id and a.ended_at is null order by a.created_at desc limit 1) veh on true
   where w.office_id=v_office.office_id and w.status in ('WAITING','ASSIGNED')),'[]'::jsonb));
end; $$;

create or replace function public.main_office_remove_waiting_entry(p_entry_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid; v_entry public.waiting_list_entries%rowtype;
begin
 v_actor:=public.current_main_office_user();
 select * into v_entry from public.waiting_list_entries where entry_id=p_entry_id for update;
 if not found then raise exception 'WAITING_ENTRY_NOT_FOUND'; end if;
 if v_entry.status<>'WAITING' then raise exception 'WAITING_ENTRY_NOT_ACTIVE'; end if;
 update public.waiting_list_entries set status='LEFT',left_at=now(),updated_at=now() where entry_id=p_entry_id;
 update public.driver_load_choices set status='WITHDRAWN',finalized_at=now(),updated_at=now()
 where queue_entry_id=p_entry_id and status='CHOSEN';
 perform public.write_audit_event('REMOVE_WAITING_ENTRY','WAITING_LIST_ENTRY',p_entry_id,jsonb_build_object('driver_id',v_entry.driver_id,'office_id',v_entry.office_id));
 return jsonb_build_object('success',true,'entry_id',p_entry_id,'status','LEFT');
end; $$;
revoke all on function public.main_office_remove_waiting_entry(uuid) from public,anon;
grant execute on function public.main_office_remove_waiting_entry(uuid) to authenticated;
notify pgrst,'reload schema';