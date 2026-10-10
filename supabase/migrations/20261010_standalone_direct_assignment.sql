-- Standalone direct assignment: no load order and no operating-center quantity.
-- Apply this migration in Supabase SQL Editor before using the updated screen.
ALTER TABLE public.bookings ALTER COLUMN load_order_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.standalone_direct_load_audit (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(booking_id),
  driver_id uuid NOT NULL REFERENCES public.drivers(driver_id),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(vehicle_id),
  factory_id uuid NOT NULL REFERENCES public.factories(factory_id),
  quarry_id uuid NOT NULL REFERENCES public.quarries(quarry_id),
  office_id uuid NOT NULL REFERENCES public.offices(office_id),
  assigned_by_auth_user_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.standalone_direct_load_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.standalone_direct_load_audit FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.direct_assign_standalone_load(
  p_factory_id uuid,
  p_quarry_id uuid,
  p_vehicle_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_office public.offices%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_driver_id uuid;
  v_location public.driver_live_locations%ROWTYPE;
  v_distance_m double precision;
  v_booking_id uuid;
BEGIN
  IF v_auth_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_auth_user_id AND au.is_active = true
      AND r.name IN ('ADMIN','HEAD_OFFICE','BRANCH')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.factories WHERE factory_id=p_factory_id AND is_active=true)
    THEN RAISE EXCEPTION 'FACTORY_NOT_FOUND_OR_INACTIVE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quarries WHERE quarry_id=p_quarry_id AND is_active=true)
    THEN RAISE EXCEPTION 'QUARRY_NOT_FOUND_OR_INACTIVE'; END IF;

  SELECT * INTO v_office FROM public.offices
  WHERE is_active=true AND office_type='BRANCH'
  ORDER BY name LIMIT 1;
  IF NOT FOUND OR v_office.latitude IS NULL OR v_office.longitude IS NULL
    THEN RAISE EXCEPTION 'OFFICE_GEOFENCE_NOT_CONFIGURED'; END IF;

  SELECT * INTO v_vehicle FROM public.vehicles
  WHERE vehicle_id=p_vehicle_id AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'VEHICLE_NOT_FOUND_OR_INACTIVE'; END IF;

  SELECT vda.driver_id INTO v_driver_id
  FROM public.vehicle_driver_assignments vda
  JOIN public.drivers d ON d.driver_id=vda.driver_id AND d.is_active=true
  WHERE vda.vehicle_id=p_vehicle_id AND vda.assigned_to IS NULL AND vda.assigned_from<=now()
  ORDER BY vda.assigned_from DESC LIMIT 1;
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'NO_ACTIVE_DRIVER_FOR_VEHICLE'; END IF;

  SELECT * INTO v_location FROM public.driver_live_locations
  WHERE driver_id=v_driver_id AND vehicle_id=p_vehicle_id;
  IF NOT FOUND OR v_location.updated_at < now()-interval '10 minutes'
    THEN RAISE EXCEPTION 'VEHICLE_LOCATION_MISSING_OR_STALE'; END IF;

  v_distance_m := 2*6371000*asin(sqrt(
    power(sin(radians(v_location.latitude-v_office.latitude)/2),2) +
    cos(radians(v_office.latitude))*cos(radians(v_location.latitude))*
    power(sin(radians(v_location.longitude-v_office.longitude)/2),2)
  ));
  IF v_distance_m>10000 THEN RAISE EXCEPTION 'VEHICLE_OUTSIDE_GEOFENCE'; END IF;

  IF EXISTS (SELECT 1 FROM public.bookings b
    WHERE b.driver_id=v_driver_id AND b.status IN ('BOOKED','LOADING_STATEMENT','IN_TRANSIT'))
    THEN RAISE EXCEPTION 'DRIVER_HAS_ACTIVE_BOOKING'; END IF;
  IF EXISTS (SELECT 1 FROM public.bookings b
    WHERE b.vehicle_id=p_vehicle_id AND b.status IN ('BOOKED','LOADING_STATEMENT','IN_TRANSIT'))
    THEN RAISE EXCEPTION 'VEHICLE_HAS_ACTIVE_BOOKING'; END IF;

  INSERT INTO public.bookings(load_order_id,driver_id,vehicle_id,status,booked_at)
  VALUES(NULL,v_driver_id,p_vehicle_id,'LOADING_STATEMENT',now())
  RETURNING booking_id INTO v_booking_id;

  INSERT INTO public.actual_loading_records(
    booking_id,load_date,vehicle_id,driver_id,quarry_id,factory_id,created_at
  ) VALUES (
    v_booking_id,CURRENT_DATE,p_vehicle_id,v_driver_id,p_quarry_id,p_factory_id,now()
  );

  INSERT INTO public.standalone_direct_load_audit(
    booking_id,driver_id,vehicle_id,factory_id,quarry_id,office_id,assigned_by_auth_user_id
  ) VALUES (
    v_booking_id,v_driver_id,p_vehicle_id,p_factory_id,p_quarry_id,v_office.office_id,v_auth_user_id
  );

  RETURN jsonb_build_object(
    'success',true,'booking_id',v_booking_id,'driver_id',v_driver_id,
    'vehicle_id',p_vehicle_id,'factory_id',p_factory_id,'quarry_id',p_quarry_id,
    'distance_m',round(v_distance_m::numeric,1),'status','LOADING_STATEMENT'
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.direct_assign_standalone_load(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.direct_assign_standalone_load(uuid,uuid,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
