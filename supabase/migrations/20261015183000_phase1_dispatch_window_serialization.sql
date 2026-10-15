-- Serialize publication per office so concurrent publishes share one five-minute window.
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
 perform pg_advisory_xact_lock(hashtextextended(v_office.office_id::text,0));
 update public.dispatch_windows set status='CLOSED',closed_at=coalesce(closed_at,now())
 where office_id=v_office.office_id and status='OPEN' and selection_ends_at<=now();
 select * into v_window from public.dispatch_windows where office_id=v_office.office_id and status='OPEN' and selection_ends_at>now() order by opened_at desc limit 1 for update;
 if not found then
  insert into public.dispatch_windows(office_id,status,opened_at,selection_ends_at,created_by)
  values(v_office.office_id,'OPEN',now(),now()+interval '5 minutes',v_actor)
  on conflict(office_id) where status='OPEN' do nothing;
  select * into v_window from public.dispatch_windows where office_id=v_office.office_id and status='OPEN' and selection_ends_at>now() order by opened_at desc limit 1 for update;
 end if;
 if v_window.dispatch_window_id is null then raise exception 'DISPATCH_WINDOW_CREATION_FAILED'; end if;
 update public.load_orders set status='PUBLISHED',published_at=now(),dispatch_window_id=v_window.dispatch_window_id,updated_at=now() where load_order_id=p_load_order_id;
 insert into public.notifications(recipient_driver_id,notification_type,title,body,payload)
 select d.driver_id,'LOAD_SELECTION_OPEN','طلب تحميل متاح للاختيار','تم نشر طلب تحميل. اختار النقلة خلال نافذة الاختيار المحددة بخمس دقائق.',
 jsonb_build_object('load_order_id',p_load_order_id,'dispatch_window_id',v_window.dispatch_window_id,'selection_ends_at',v_window.selection_ends_at,'factory_id',v_order.factory_id,'quarry_id',v_order.quarry_id)
 from public.drivers d join public.driver_live_locations l on l.driver_id=d.driver_id
 where d.is_active=true and d.office_id=v_office.office_id and l.captured_at>=now()-interval '10 minutes' and l.captured_at<=now()+interval '1 minute' and l.accuracy_m is not null and l.accuracy_m<=100
 and 6371000*2*asin(sqrt(least(1,greatest(0,power(sin(radians(l.latitude-v_office.latitude)/2),2)+cos(radians(v_office.latitude))*cos(radians(l.latitude))*power(sin(radians(l.longitude-v_office.longitude)/2),2)))))<=coalesce(v_office.geofence_radius_m,10000)
 and exists(select 1 from public.waiting_list_entries w where w.driver_id=d.driver_id and w.office_id=v_office.office_id and w.status='WAITING')
 and exists(select 1 from public.driver_vehicle_assignments a join public.vehicles v on v.vehicle_id=a.vehicle_id where a.driver_id=d.driver_id and a.ended_at is null and v.is_active=true and v.office_id=v_office.office_id)
 and not exists(select 1 from public.bookings b where b.driver_id=d.driver_id and b.status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT'));
 get diagnostics v_notified=row_count;
 perform public.write_audit_event('PUBLISH_LOAD_ORDER','LOAD_ORDER',p_load_order_id,jsonb_build_object('dispatch_window_id',v_window.dispatch_window_id,'selection_ends_at',v_window.selection_ends_at,'eligible_drivers_notified',v_notified));
 return jsonb_build_object('load_order_id',p_load_order_id,'status','PUBLISHED','dispatch_window_id',v_window.dispatch_window_id,'selection_ends_at',v_window.selection_ends_at,'selection_window_seconds',300,'eligible_drivers_notified',v_notified);
end; $$;
notify pgrst,'reload schema';