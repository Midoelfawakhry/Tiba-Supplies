create or replace function public.driver_update_live_location(p_latitude double precision,p_longitude double precision,p_accuracy_m double precision,p_captured_at timestamptz)
returns jsonb
language plpgsql security definer set search_path=pg_catalog,public
as $$
declare v_driver public.drivers%rowtype;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_latitude is null or p_latitude not between -90 and 90 or p_longitude is null or p_longitude not between -180 and 180 then raise exception 'INVALID_COORDINATES'; end if;
 if p_accuracy_m is null or p_accuracy_m < 0 or p_accuracy_m > 100 then raise exception 'LOCATION_ACCURACY_TOO_LOW'; end if;
 if p_captured_at is null or p_captured_at < now() - interval '10 minutes' or p_captured_at > now() + interval '1 minute' then raise exception 'LOCATION_TIMESTAMP_STALE_OR_INVALID'; end if;
 select * into v_driver from public.drivers where auth_user_id=auth.uid() and is_active=true for update;
 if not found then raise exception 'ACTIVE_DRIVER_ACCOUNT_REQUIRED'; end if;
 insert into public.driver_live_locations(driver_id,latitude,longitude,accuracy_m,captured_at,received_at)
 values(v_driver.driver_id,p_latitude,p_longitude,p_accuracy_m,p_captured_at,now())
 on conflict(driver_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,captured_at=excluded.captured_at,received_at=now()
 where public.driver_live_locations.captured_at <= excluded.captured_at;
 return jsonb_build_object('driver_id',v_driver.driver_id,'captured_at',p_captured_at,'accepted',true);
end;
$$;
revoke all on function public.driver_update_live_location(double precision,double precision,double precision,timestamptz) from public,anon,authenticated;
grant execute on function public.driver_update_live_location(double precision,double precision,double precision,timestamptz) to authenticated;

create or replace function public.driver_confirm_arrival(p_booking_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_m double precision,p_captured_at timestamptz)
returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_driver public.drivers%rowtype; v_booking public.bookings%rowtype; v_office public.offices%rowtype; v_distance_m double precision;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_booking_id is null then raise exception 'BOOKING_ID_REQUIRED'; end if;
 if p_latitude is null or p_latitude not between -90 and 90 or p_longitude is null or p_longitude not between -180 and 180 then raise exception 'INVALID_COORDINATES'; end if;
 if p_accuracy_m is null or p_accuracy_m<0 or p_accuracy_m>100 then raise exception 'LOCATION_ACCURACY_TOO_LOW'; end if;
 if p_captured_at is null or p_captured_at<now()-interval '10 minutes' or p_captured_at>now()+interval '1 minute' then raise exception 'LOCATION_TIMESTAMP_STALE_OR_INVALID'; end if;
 select * into v_driver from public.drivers where auth_user_id=auth.uid() and is_active=true;
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
 perform public.write_audit_event('DRIVER_CONFIRM_ARRIVAL','BOOKING',p_booking_id,jsonb_build_object('driver_id',v_driver.driver_id,'distance_m',round(v_distance_m::numeric,1),'captured_at',p_captured_at));
 return jsonb_build_object('booking_id',p_booking_id,'status','ARRIVED','distance_m',round(v_distance_m::numeric,1));
end;
$$;
revoke all on function public.driver_confirm_arrival(uuid,double precision,double precision,double precision,timestamptz) from public,anon,authenticated;
grant execute on function public.driver_confirm_arrival(uuid,double precision,double precision,double precision,timestamptz) to authenticated;