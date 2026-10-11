-- Phase 1 fix: provide the server-side geofence helper used by dispatch_load.
-- A driver is eligible only with a fresh location inside the active check-in office radius.
CREATE OR REPLACE FUNCTION public.get_driver_geofence_status(p_driver_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_office public.offices%ROWTYPE;
  v_loc public.driver_live_locations%ROWTYPE;
  v_distance_m double precision;
  v_eligible boolean := false;
BEGIN
  SELECT o.* INTO v_office
  FROM public.offices o
  WHERE o.office_type = 'BRANCH' AND o.is_active = true
  ORDER BY o.name LIMIT 1;

  IF v_office.office_id IS NULL OR v_office.latitude IS NULL OR v_office.longitude IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'office_id', v_office.office_id,
      'reason', 'CHECK_IN_OFFICE_LOCATION_NOT_CONFIGURED');
  END IF;

  SELECT l.* INTO v_loc
  FROM public.driver_live_locations l
  WHERE l.driver_id = p_driver_id
  ORDER BY l.updated_at DESC LIMIT 1;

  IF v_loc.driver_id IS NULL OR v_loc.latitude IS NULL OR v_loc.longitude IS NULL
     OR v_loc.updated_at < now() - interval '10 minutes' THEN
    RETURN jsonb_build_object('eligible', false, 'office_id', v_office.office_id,
      'reason', 'LOCATION_MISSING_OR_STALE');
  END IF;

  v_distance_m := 2 * 6371000 * asin(sqrt(
    power(sin(radians(v_loc.latitude - v_office.latitude) / 2), 2) +
    cos(radians(v_office.latitude)) * cos(radians(v_loc.latitude)) *
    power(sin(radians(v_loc.longitude - v_office.longitude) / 2), 2)
  ));
  v_eligible := v_distance_m <= COALESCE(v_office.geofence_radius_m, 10000);

  RETURN jsonb_build_object('eligible', v_eligible, 'office_id', v_office.office_id,
    'distance_m', round(v_distance_m::numeric, 1),
    'radius_m', COALESCE(v_office.geofence_radius_m, 10000),
    'reason', CASE WHEN v_eligible THEN 'INSIDE_GEOFENCE' ELSE 'OUTSIDE_GEOFENCE' END);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_driver_geofence_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_driver_geofence_status(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_driver_geofence_status(uuid) FROM authenticated;
