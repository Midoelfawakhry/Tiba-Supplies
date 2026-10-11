-- Phase 1: vehicle and vehicle-owner trip accounts.
-- Read-only reporting RPC; does not alter existing loading records.
CREATE OR REPLACE FUNCTION public.get_vehicle_owner_reports(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_auth_user_id
      AND au.is_active = true
      AND r.name IN ('ADMIN', 'HEAD_OFFICE', 'BRANCH')
  ) THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE';
  END IF;

  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
    RAISE EXCEPTION 'INVALID_DATE_RANGE';
  END IF;

  SELECT jsonb_build_object(
    'vehicles',
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'vehicle_id', v.vehicle_id,
          'plate_number', v.plate_number,
          'vehicle_code', v.vehicle_code,
          'owner_id', vo.owner_id,
          'owner_name', vo.name,
          'owner_phone', vo.phone,
          'is_active', v.is_active
        ) ORDER BY v.plate_number)
        FROM public.vehicles v
        LEFT JOIN public.vehicle_owners vo ON vo.owner_id = v.owner_id
      ), '[]'::jsonb),
    'owners',
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'owner_id', vo.owner_id,
          'name', vo.name,
          'phone', vo.phone,
          'is_active', vo.is_active,
          'vehicle_count', (
            SELECT count(*) FROM public.vehicles v2 WHERE v2.owner_id = vo.owner_id
          )
        ) ORDER BY vo.name)
        FROM public.vehicle_owners vo
      ), '[]'::jsonb),
    'trips',
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'actual_load_id', alr.actual_load_id,
          'booking_id', alr.booking_id,
          'load_date', alr.load_date,
          'created_at', alr.created_at,
          'vehicle_id', alr.vehicle_id,
          'plate_number', v.plate_number,
          'vehicle_code', v.vehicle_code,
          'owner_id', v.owner_id,
          'owner_name', vo.name,
          'driver_id', alr.driver_id,
          'driver_name', d.name,
          'quarry_id', alr.quarry_id,
          'quarry_name', q.name,
          'factory_id', alr.factory_id,
          'factory_name', f.name,
          'ticket_number', alr.ticket_number,
          'actual_weight', alr.actual_weight,
          'scale_image_path', alr.scale_image_path,
          'delivery_confirmed_at', alr.delivery_confirmed_at,
          'booking_status', b.status,
          'is_completed', (alr.delivery_confirmed_at IS NOT NULL AND alr.actual_weight IS NOT NULL)
        ) ORDER BY COALESCE(alr.load_date, alr.created_at::date) DESC, alr.created_at DESC)
        FROM public.actual_loading_records alr
        LEFT JOIN public.vehicles v ON v.vehicle_id = alr.vehicle_id
        LEFT JOIN public.vehicle_owners vo ON vo.owner_id = v.owner_id
        LEFT JOIN public.drivers d ON d.driver_id = alr.driver_id
        LEFT JOIN public.quarries q ON q.quarry_id = alr.quarry_id
        LEFT JOIN public.factories f ON f.factory_id = alr.factory_id
        LEFT JOIN public.bookings b ON b.booking_id = alr.booking_id
        WHERE (p_from IS NULL OR COALESCE(alr.load_date, alr.created_at::date) >= p_from)
          AND (p_to IS NULL OR COALESCE(alr.load_date, alr.created_at::date) <= p_to)
      ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_vehicle_owner_reports(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_vehicle_owner_reports(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_owner_reports(date, date) TO authenticated;
