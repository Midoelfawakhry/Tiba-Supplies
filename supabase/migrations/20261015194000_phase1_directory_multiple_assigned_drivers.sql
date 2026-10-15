-- Return all active drivers assigned to each vehicle so the office directory supports multiple drivers per vehicle.
CREATE OR REPLACE FUNCTION public.main_office_get_directory()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE v_actor uuid;
BEGIN
 v_actor := public.current_main_office_user();
 RETURN jsonb_build_object(
  'factories', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',factory_id,'code',factory_code,'name',name,'notes',notes,'is_active',is_active) ORDER BY name),'[]'::jsonb) FROM public.factories),
  'quarries', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',quarry_id,'code',quarry_code,'name',name,'notes',notes,'is_active',is_active,'latitude',latitude,'longitude',longitude) ORDER BY name),'[]'::jsonb) FROM public.quarries),
  'owners', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',owner_id,'code',owner_code,'name',name,'phone',phone,'notes',notes,'is_active',is_active) ORDER BY name),'[]'::jsonb) FROM public.vehicle_owners),
  'vehicles', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',v.vehicle_id,'code',v.vehicle_code,'plate_number',v.plate_number,'owner_id',v.owner_id,'office_id',v.office_id,'notes',v.notes,'is_active',v.is_active,
    'assigned_drivers', coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.driver_id,'name',d.name,'code',d.driver_code) ORDER BY d.name)
      FROM public.driver_vehicle_assignments a JOIN public.drivers d ON d.driver_id=a.driver_id
      WHERE a.vehicle_id=v.vehicle_id AND a.ended_at IS NULL),'[]'::jsonb)
   ) ORDER BY v.plate_number),'[]'::jsonb) FROM public.vehicles v),
  'drivers', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.driver_id,'code',d.driver_code,'name',d.name,'phone',d.phone,'office_id',d.office_id,'is_active',d.is_active,'vehicle_id',a.vehicle_id,'vehicle_code',v.vehicle_code,'plate_number',v.plate_number) ORDER BY d.name),'[]'::jsonb) FROM public.drivers d LEFT JOIN public.driver_vehicle_assignments a ON a.driver_id=d.driver_id AND a.ended_at IS NULL LEFT JOIN public.vehicles v ON v.vehicle_id=a.vehicle_id)
 );
END
$function$;
REVOKE ALL ON FUNCTION public.main_office_get_directory() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.main_office_get_directory() TO authenticated;
