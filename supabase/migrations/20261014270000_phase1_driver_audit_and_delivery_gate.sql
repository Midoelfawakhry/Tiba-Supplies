-- Phase 1 hardening: driver audit ownership and delivery confirmation gate.
create or replace function public.driver_confirm_arrival(p_booking_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_m double precision,p_captured_at timestamptz)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_driver public.drivers%rowtype; v_booking public.bookings%rowtype; v_office public.offices%rowtype; v_distance_m double precision;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_booking_id is null then raise exception 'BOOKING_ID_REQUIRED'; end if;
 if p_latitude is null or p_latitude not between -90 and 90 or p_longitude is null or p_longitude not between -180 and 180 then raise exception 'INVALID_COORDINATES'; end if;
 if p_accuracy_m is null or p_accuracy_m<0 or p_accuracy_m>100 then raise exception 'LOCATION_ACCURACY_TOO_LOW'; end if;
 if p_captured_at is null or p_captured_at<now()-interval '10 minutes' or p_captured_at>now()+interval '1 minute' then raise exception 'LOCATION_TIMESTAMP_STALE_OR_INVALID'; end if;
 select * into v_driver from public.drivers where auth_user_id=auth.uid() and is_active=true for update;
 if not found then raise exception 'ACTIVE_DRIVER_ACCOUNT_REQUIRED'; end if;
 select * into v_booking from public.bookings where booking_id=p_booking_id and driver_id=v_driver.driver_id for update;
 if not found then raise exception 'BOOKING_NOT_YOURS'; end if;
 if v_booking.status<>'ASSIGNED' then raise exception 'BOOKING_NOT_AWAITING_ARRIVAL'; end if;
 select * into v_office from public.offices where office_code='RAS_SEDR' and office_type='BRANCH' and is_active=true;
 if not found or v_office.latitude is null or v_office.longitude is null then raise exception 'RAS_SEDR_GEOFENCE_NOT_CONFIGURED'; end if;
 v_distance_m:=6371000*2*asin(sqrt(power(sin(radians(p_latitude-v_office.latitude)/2),2)+cos(radians(v_office.latitude))*cos(radians(p_latitude))*power(sin(radians(p_longitude-v_office.longitude)/2),2)));
 if v_distance_m>v_office.geofence_radius_m then raise exception 'OUTSIDE_RAS_SEDR_GEOFENCE'; end if;
 update public.bookings set status='ARRIVED',arrived_at=now(),updated_at=now() where booking_id=p_booking_id;
 insert into public.driver_live_locations(driver_id,latitude,longitude,accuracy_m,captured_at,received_at)
 values(v_driver.driver_id,p_latitude,p_longitude,p_accuracy_m,p_captured_at,now())
 on conflict(driver_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,captured_at=excluded.captured_at,received_at=now()
 where public.driver_live_locations.captured_at<=excluded.captured_at;
 -- Driver audit events must not invoke the Main-Office-only audit helper.
 insert into public.audit_log(actor_auth_user_id,actor_app_user_id,action,entity_type,entity_id,details)
 values(auth.uid(),null,'DRIVER_CONFIRM_ARRIVAL','BOOKING',p_booking_id,jsonb_build_object('driver_id',v_driver.driver_id,'distance_m',round(v_distance_m::numeric,1),'captured_at',p_captured_at));
 return jsonb_build_object('booking_id',p_booking_id,'status','ARRIVED','distance_m',round(v_distance_m::numeric,1));
end; $$;
revoke all on function public.driver_confirm_arrival(uuid,double precision,double precision,double precision,timestamptz) from public,anon,authenticated;
grant execute on function public.driver_confirm_arrival(uuid,double precision,double precision,double precision,timestamptz) to authenticated;

create or replace function public.driver_confirm_delivery(p_booking_id uuid,p_latitude double precision,p_longitude double precision,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_driver public.drivers%rowtype; v_booking public.bookings%rowtype;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_booking_id is null then raise exception 'BOOKING_ID_REQUIRED'; end if;
 if p_latitude is null or p_latitude not between -90 and 90 or p_longitude is null or p_longitude not between -180 and 180 then raise exception 'INVALID_COORDINATES'; end if;
 select * into v_driver from public.drivers where auth_user_id=auth.uid() and is_active=true for update;
 if not found then raise exception 'ACTIVE_DRIVER_ACCOUNT_REQUIRED'; end if;
 select * into v_booking from public.bookings where booking_id=p_booking_id and driver_id=v_driver.driver_id for update;
 if not found then raise exception 'BOOKING_NOT_YOURS'; end if;
 if v_booking.status<>'IN_TRANSIT' then raise exception 'BOOKING_NOT_IN_TRANSIT'; end if;
 insert into public.delivery_confirmations(booking_id,confirmed_by_driver_id,latitude,longitude,confirmed_at,notes)
 values(p_booking_id,v_driver.driver_id,p_latitude,p_longitude,now(),nullif(trim(p_notes),''))
 on conflict(booking_id) do nothing;
 if not exists(select 1 from public.delivery_confirmations where booking_id=p_booking_id and confirmed_by_driver_id=v_driver.driver_id) then raise exception 'DELIVERY_CONFIRMATION_CONFLICT'; end if;
 insert into public.audit_log(actor_auth_user_id,actor_app_user_id,action,entity_type,entity_id,details)
 values(auth.uid(),null,'DRIVER_CONFIRM_DELIVERY','BOOKING',p_booking_id,jsonb_build_object('driver_id',v_driver.driver_id,'latitude',p_latitude,'longitude',p_longitude));
 return jsonb_build_object('booking_id',p_booking_id,'confirmation_required_for_completion',true,'confirmed_at',now());
end; $$;
revoke all on function public.driver_confirm_delivery(uuid,double precision,double precision,text) from public,anon,authenticated;
grant execute on function public.driver_confirm_delivery(uuid,double precision,double precision,text) to authenticated;

create or replace function public.main_office_advance_booking(p_booking_id uuid,p_next_status text,p_actual_weight numeric default null,p_ticket_number text default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid; v_booking public.bookings%rowtype; v_next text:=upper(trim(coalesce(p_next_status,'')));
begin
 v_actor:=public.current_main_office_user();
 if p_booking_id is null then raise exception 'BOOKING_ID_REQUIRED'; end if;
 if v_next not in ('LOADING','LOADED','IN_TRANSIT','DELIVERED','CANCELLED') then raise exception 'INVALID_NEXT_BOOKING_STATUS'; end if;
 select * into v_booking from public.bookings where booking_id=p_booking_id for update;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if v_booking.status in ('CANCELLED','DELIVERED') then raise exception 'BOOKING_TERMINAL_STATE'; end if;
 if v_next='LOADING' and v_booking.status<>'ARRIVED' then raise exception 'ARRIVAL_REQUIRED_BEFORE_LOADING'; end if;
 if v_next='LOADED' then
  if v_booking.status<>'LOADING' then raise exception 'LOADING_STATE_REQUIRED'; end if;
  if p_actual_weight is null or p_actual_weight<=0 then raise exception 'POSITIVE_ACTUAL_WEIGHT_REQUIRED'; end if;
  insert into public.actual_loading_records(booking_id,actual_weight,ticket_number,recorded_by,notes)
  values(v_booking.booking_id,p_actual_weight,nullif(trim(p_ticket_number),''),v_actor,p_notes);
 end if;
 if v_next='IN_TRANSIT' and v_booking.status<>'LOADED' then raise exception 'LOADED_STATE_REQUIRED'; end if;
 if v_next='DELIVERED' then
  if v_booking.status<>'IN_TRANSIT' then raise exception 'IN_TRANSIT_STATE_REQUIRED'; end if;
  if not exists(select 1 from public.delivery_confirmations dc where dc.booking_id=p_booking_id and dc.confirmed_by_driver_id=v_booking.driver_id) then raise exception 'DRIVER_DELIVERY_CONFIRMATION_REQUIRED'; end if;
 end if;
 if v_next='CANCELLED' then
  if nullif(trim(p_notes),'') is null then raise exception 'CANCELLATION_REASON_REQUIRED'; end if;
  if v_booking.status in ('LOADING','LOADED','IN_TRANSIT') then raise exception 'TRIP_PROGRESS_PREVENTS_CANCELLATION'; end if;
  update public.bookings set cancellation_reason=trim(p_notes),cancelled_at=now() where booking_id=p_booking_id;
 end if;
 update public.bookings set status=v_next,updated_at=now() where booking_id=p_booking_id;
 if v_next='DELIVERED' then
  update public.load_orders lo set status=case when not exists(select 1 from public.bookings b where b.load_order_id=lo.load_order_id and b.status not in ('DELIVERED','CANCELLED') and b.booking_id<>p_booking_id) then 'COMPLETED' else 'IN_PROGRESS' end,updated_at=now()
  where lo.load_order_id=v_booking.load_order_id;
 end if;
 perform public.write_audit_event('ADVANCE_BOOKING_'||v_next,'BOOKING',p_booking_id,jsonb_build_object('previous_status',v_booking.status,'next_status',v_next,'actual_weight',p_actual_weight,'ticket_number',p_ticket_number));
 return jsonb_build_object('booking_id',p_booking_id,'previous_status',v_booking.status,'status',v_next);
end; $$;
revoke all on function public.main_office_advance_booking(uuid,text,numeric,text,text) from public,anon,authenticated;
grant execute on function public.main_office_advance_booking(uuid,text,numeric,text,text) to authenticated;