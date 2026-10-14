-- Ensure an operational booking always uses the driver's currently assigned fleet vehicle.
create or replace function public.main_office_direct_assign(p_load_order_id uuid,p_driver_id uuid,p_vehicle_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid; v_order public.load_orders%rowtype; v_driver public.drivers%rowtype; v_vehicle public.vehicles%rowtype; v_booking_id uuid; v_trip_code text; v_office_id uuid;
begin
 v_actor:=public.current_main_office_user();
 if p_load_order_id is null or p_driver_id is null or p_vehicle_id is null then raise exception 'LOAD_DRIVER_VEHICLE_REQUIRED'; end if;
 select * into v_order from public.load_orders where load_order_id=p_load_order_id for update;
 if not found then raise exception 'LOAD_ORDER_NOT_FOUND'; end if;
 if v_order.status<>'PUBLISHED' then raise exception 'LOAD_ORDER_NOT_PUBLISHED'; end if;
 select office_id into v_office_id from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true;
 if v_office_id is null then raise exception 'RAS_SEDR_BRANCH_CONFIGURATION_INVALID'; end if;
 select * into v_driver from public.drivers where driver_id=p_driver_id for update;
 if not found or not v_driver.is_active then raise exception 'DRIVER_NOT_ACTIVE'; end if;
 select * into v_vehicle from public.vehicles where vehicle_id=p_vehicle_id for update;
 if not found or not v_vehicle.is_active then raise exception 'VEHICLE_NOT_ACTIVE'; end if;
 if v_driver.office_id<>v_office_id or v_vehicle.office_id<>v_office_id then raise exception 'DRIVER_OR_VEHICLE_NOT_ASSIGNED_TO_RAS_SEDR'; end if;
 if not exists(select 1 from public.driver_vehicle_assignments a where a.driver_id=p_driver_id and a.vehicle_id=p_vehicle_id and a.ended_at is null) then
   raise exception 'VEHICLE_NOT_ASSIGNED_TO_DRIVER';
 end if;
 if exists(select 1 from public.bookings where driver_id=p_driver_id and status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT')) then raise exception 'DRIVER_HAS_ACTIVE_BOOKING'; end if;
 if exists(select 1 from public.bookings where vehicle_id=p_vehicle_id and status in ('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT')) then raise exception 'VEHICLE_HAS_ACTIVE_BOOKING'; end if;
 v_trip_code:=format('TIBA-%s',upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));
 insert into public.bookings(load_order_id,driver_id,vehicle_id,assigned_by,assignment_type,status,trip_code)
 values(p_load_order_id,p_driver_id,p_vehicle_id,v_actor,'DIRECT','ASSIGNED',v_trip_code) returning booking_id into v_booking_id;
 update public.load_orders set status='IN_PROGRESS',updated_at=now() where load_order_id=p_load_order_id;
 insert into public.notifications(recipient_driver_id,notification_type,title,body,payload)
 values(p_driver_id,'DIRECT_ASSIGNMENT','إسناد تحميل مباشر','تم إسناد أمر تحميل إليك',jsonb_build_object('booking_id',v_booking_id,'load_order_id',p_load_order_id,'trip_code',v_trip_code));
 perform public.write_audit_event('DIRECT_ASSIGN_LOAD','BOOKING',v_booking_id,jsonb_build_object('load_order_id',p_load_order_id,'driver_id',p_driver_id,'vehicle_id',p_vehicle_id,'trip_code',v_trip_code));
 return jsonb_build_object('booking_id',v_booking_id,'load_order_id',p_load_order_id,'driver_id',p_driver_id,'vehicle_id',p_vehicle_id,'trip_code',v_trip_code,'status','ASSIGNED');
end $$;
revoke all on function public.main_office_direct_assign(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.main_office_direct_assign(uuid,uuid,uuid) to authenticated;
