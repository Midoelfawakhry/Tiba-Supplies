-- Keep delivery confirmation idempotent, including its audit trail.
create or replace function public.driver_confirm_delivery(
 p_booking_id uuid,p_latitude double precision,p_longitude double precision,
 p_accuracy_m double precision,p_captured_at timestamptz,p_notes text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 v_driver public.drivers%rowtype;
 v_booking public.bookings%rowtype;
 v_confirmation public.delivery_confirmations%rowtype;
 v_inserted boolean:=false;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_booking_id is null then raise exception 'BOOKING_ID_REQUIRED'; end if;
 if p_latitude is null or p_latitude not between -90 and 90 or p_longitude is null or p_longitude not between -180 and 180 then raise exception 'INVALID_COORDINATES'; end if;
 if p_accuracy_m is null or p_accuracy_m<0 or p_accuracy_m>100 then raise exception 'LOCATION_ACCURACY_TOO_LOW'; end if;
 if p_captured_at is null or p_captured_at<now()-interval '10 minutes' or p_captured_at>now()+interval '1 minute' then raise exception 'LOCATION_TIMESTAMP_STALE_OR_INVALID'; end if;
 select * into v_driver from public.drivers where auth_user_id=auth.uid() and is_active=true for update;
 if not found then raise exception 'ACTIVE_DRIVER_ACCOUNT_REQUIRED'; end if;
 select * into v_booking from public.bookings where booking_id=p_booking_id and driver_id=v_driver.driver_id for update;
 if not found then raise exception 'BOOKING_NOT_YOURS'; end if;
 if v_booking.status<>'IN_TRANSIT' then raise exception 'BOOKING_NOT_IN_TRANSIT'; end if;
 insert into public.delivery_confirmations(booking_id,confirmed_by_driver_id,latitude,longitude,confirmed_at,notes)
 values(p_booking_id,v_driver.driver_id,p_latitude,p_longitude,now(),nullif(trim(p_notes),'')) on conflict(booking_id) do nothing;
 get diagnostics v_inserted = row_count;
 select * into v_confirmation from public.delivery_confirmations where booking_id=p_booking_id;
 if v_confirmation.confirmed_by_driver_id<>v_driver.driver_id then raise exception 'DELIVERY_CONFIRMATION_CONFLICT'; end if;
 if v_inserted then
   insert into public.audit_log(actor_auth_user_id,actor_app_user_id,action,entity_type,entity_id,details)
   values(auth.uid(),null,'DRIVER_CONFIRM_DELIVERY','BOOKING',p_booking_id,jsonb_build_object('driver_id',v_driver.driver_id,'accuracy_m',p_accuracy_m,'captured_at',p_captured_at,'confirmed_at',v_confirmation.confirmed_at));
 end if;
 return jsonb_build_object('booking_id',p_booking_id,'confirmed',true,'already_confirmed',not v_inserted,'confirmed_at',v_confirmation.confirmed_at);
end; $$;
revoke all on function public.driver_confirm_delivery(uuid,double precision,double precision,double precision,timestamptz,text) from public,anon,authenticated;
grant execute on function public.driver_confirm_delivery(uuid,double precision,double precision,double precision,timestamptz,text) to authenticated;