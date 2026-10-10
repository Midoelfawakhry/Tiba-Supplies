-- Live vehicle tracking. Location is shared only after the signed-in driver grants device location permission.
CREATE TABLE IF NOT EXISTS public.driver_live_locations (
  driver_id uuid PRIMARY KEY REFERENCES public.drivers(driver_id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(vehicle_id) ON DELETE CASCADE,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m double precision,
  heading double precision,
  speed_kmh double precision,
  captured_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driver_live_locations_updated ON public.driver_live_locations(updated_at DESC);
ALTER TABLE public.driver_live_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driver_live_locations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_driver_live_location(
  p_latitude double precision, p_longitude double precision,
  p_accuracy_m double precision DEFAULT NULL, p_heading double precision DEFAULT NULL,
  p_speed_kmh double precision DEFAULT NULL, p_captured_at timestamptz DEFAULT now()
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_driver_id uuid; v_vehicle_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'INVALID_COORDINATES'; END IF;
  SELECT d.driver_id INTO v_driver_id FROM public.drivers d WHERE d.auth_user_id = auth.uid() AND d.is_active = true LIMIT 1;
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'DRIVER_ACCOUNT_NOT_LINKED'; END IF;
  SELECT vda.vehicle_id INTO v_vehicle_id
  FROM public.vehicle_driver_assignments vda JOIN public.vehicles v ON v.vehicle_id = vda.vehicle_id AND v.is_active = true
  WHERE vda.driver_id = v_driver_id AND vda.assigned_to IS NULL AND vda.assigned_from <= now()
  ORDER BY vda.assigned_from DESC LIMIT 1;
  IF v_vehicle_id IS NULL THEN RAISE EXCEPTION 'NO_ACTIVE_VEHICLE_ASSIGNMENT'; END IF;
  INSERT INTO public.driver_live_locations(driver_id,vehicle_id,latitude,longitude,accuracy_m,heading,speed_kmh,captured_at,updated_at)
  VALUES(v_driver_id,v_vehicle_id,p_latitude,p_longitude,p_accuracy_m,p_heading,p_speed_kmh,COALESCE(p_captured_at,now()),now())
  ON CONFLICT(driver_id) DO UPDATE SET vehicle_id=EXCLUDED.vehicle_id,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,accuracy_m=EXCLUDED.accuracy_m,heading=EXCLUDED.heading,speed_kmh=EXCLUDED.speed_kmh,captured_at=EXCLUDED.captured_at,updated_at=now();
  RETURN jsonb_build_object('success',true,'driver_id',v_driver_id,'vehicle_id',v_vehicle_id,'updated_at',now());
END; $function$;

CREATE OR REPLACE FUNCTION public.get_vehicle_live_locations()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_auth_user_id uuid := auth.uid();
BEGIN
  IF v_auth_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users au JOIN public.user_roles ur ON ur.user_id=au.user_id JOIN public.roles r ON r.role_id=ur.role_id
    WHERE au.auth_user_id=v_auth_user_id AND au.is_active=true AND r.name IN ('ADMIN','HEAD_OFFICE','BRANCH')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'driver_id',d.driver_id,'driver_name',d.name,'vehicle_id',v.vehicle_id,'plate_number',v.plate_number,
      'latitude',loc.latitude,'longitude',loc.longitude,'accuracy_m',loc.accuracy_m,'heading',loc.heading,
      'speed_kmh',loc.speed_kmh,'captured_at',loc.captured_at,'updated_at',loc.updated_at,
      'is_stale',loc.updated_at < now()-interval '10 minutes'
    ) ORDER BY loc.updated_at DESC)
    FROM public.driver_live_locations loc JOIN public.drivers d ON d.driver_id=loc.driver_id JOIN public.vehicles v ON v.vehicle_id=loc.vehicle_id
    WHERE d.is_active=true AND v.is_active=true
  ),'[]'::jsonb);
END; $function$;
REVOKE ALL ON FUNCTION public.update_driver_live_location(double precision,double precision,double precision,double precision,double precision,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_driver_live_location(double precision,double precision,double precision,double precision,double precision,timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.get_vehicle_live_locations() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_live_locations() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_office_waiting_list()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_auth_user_id uuid := auth.uid(); v_office_id uuid;
BEGIN
  IF v_auth_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users au JOIN public.user_roles ur ON ur.user_id=au.user_id JOIN public.roles r ON r.role_id=ur.role_id
    WHERE au.auth_user_id=v_auth_user_id AND au.is_active=true AND r.name IN ('ADMIN','HEAD_OFFICE','BRANCH')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;
  SELECT office_id INTO v_office_id FROM public.offices WHERE is_active=true AND office_type='BRANCH' ORDER BY name LIMIT 1;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'entry_id',w.entry_id,'driver_id',d.driver_id,'driver_name',d.name,
      'vehicle_id',v.vehicle_id,'plate_number',v.plate_number,'status',w.status,'arrived_at',w.arrived_at
    ) ORDER BY w.arrived_at)
    FROM public.waiting_list_entries w
    JOIN public.drivers d ON d.driver_id=w.driver_id
    JOIN public.vehicles v ON v.vehicle_id=w.vehicle_id
    WHERE w.office_id=v_office_id AND w.status='WAITING'
  ),'[]'::jsonb);
END; $function$;
REVOKE ALL ON FUNCTION public.get_office_waiting_list() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_office_waiting_list() TO authenticated;
