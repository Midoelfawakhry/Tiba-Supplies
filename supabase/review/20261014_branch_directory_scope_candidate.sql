-- SHADOW CANDIDATE ONLY — NOT APPLIED TO ANY DATABASE
-- Purpose: prevent the branch snapshot directory from exposing every active driver across branches.
-- Business assumption to validate: a branch directory should include only drivers with a current assignment to the authenticated branch.
-- Existing function body was fetched from the live definition; only the directory predicate was transformed.
-- Review the diff and run branch-isolation tests in a dedicated staging database before applying.
-- Do not apply to production.

CREATE OR REPLACE FUNCTION public.get_branch_office_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_user_id uuid;
  v_branch_office_id uuid;
  v_head_office_id uuid;
BEGIN
  IF v_auth_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT au.user_id, au.office_id INTO v_user_id, v_branch_office_id
  FROM public.app_users au
  JOIN public.user_roles ur ON ur.user_id = au.user_id
  JOIN public.roles r ON r.role_id = ur.role_id
  WHERE au.auth_user_id = v_auth_user_id
    AND au.is_active = true
    AND r.name = 'BRANCH'
    AND au.office_id IS NOT NULL
  LIMIT 1;

  IF v_user_id IS NULL THEN RAISE EXCEPTION 'BRANCH_ACCOUNT_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.offices o
    WHERE o.office_id = v_branch_office_id AND o.office_type = 'BRANCH' AND o.is_active = true
  ) THEN RAISE EXCEPTION 'BRANCH_OFFICE_INACTIVE'; END IF;

  SELECT o.office_id INTO v_head_office_id
  FROM public.offices o
  WHERE o.office_type = 'HEAD' AND o.is_active = true
  ORDER BY o.created_at, o.name LIMIT 1;
  IF v_head_office_id IS NULL THEN RAISE EXCEPTION 'ACTIVE_HEAD_OFFICE_NOT_CONFIGURED'; END IF;

  RETURN jsonb_build_object(
    'office', (SELECT jsonb_build_object('office_id', o.office_id, 'name', o.name, 'geofence_radius_m', o.geofence_radius_m)
               FROM public.offices o WHERE o.office_id = v_branch_office_id),
    'actual_loading_records', COALESCE((
      SELECT jsonb_agg(x.item ORDER BY x.created_at DESC)
      FROM (
        SELECT alr.created_at,
          jsonb_build_object(
            'actual_load_id', alr.actual_load_id,
            'trip_code', alr.trip_code,
            'daily_load_number', alr.daily_load_number,
            'loading_sequence_date', alr.loading_sequence_date,
            'booking_id', alr.booking_id,
            'load_date', alr.load_date,
            'ticket_number', alr.ticket_number,
            'actual_weight', alr.actual_weight,
            'scale_image_path', alr.scale_image_path,
            'delivery_confirmed_at', alr.delivery_confirmed_at,
            'driver_name', d.name,
            'driver_phone', d.phone,
            'plate_number', v.plate_number,
            'vehicle_code', v.vehicle_code,
            'factory_name', f.name,
            'quarry_name', q.name,
            'booking_status', b.status
          ) AS item
        FROM public.actual_loading_records alr
        JOIN public.bookings b ON b.booking_id = alr.booking_id
        LEFT JOIN public.load_orders lo ON lo.load_order_id = b.load_order_id
        LEFT JOIN public.standalone_direct_load_audit sda ON sda.booking_id = b.booking_id
        LEFT JOIN public.drivers d ON d.driver_id = alr.driver_id
        LEFT JOIN public.vehicles v ON v.vehicle_id = alr.vehicle_id
        LEFT JOIN public.factories f ON f.factory_id = alr.factory_id
        LEFT JOIN public.quarries q ON q.quarry_id = alr.quarry_id
        WHERE (
            (lo.office_id = v_head_office_id AND lo.check_in_office_id = v_branch_office_id)
            OR (lo.load_order_id IS NULL AND sda.office_id = v_branch_office_id)
          )
          AND alr.load_date >= CURRENT_DATE - 89
        ORDER BY alr.created_at DESC
        LIMIT 500
      ) x
    ), '[]'::jsonb),
    'available_loads', COALESCE((
      SELECT jsonb_agg(x.item ORDER BY x.priority DESC, x.created_at ASC)
      FROM (
        SELECT lo.created_at, lo.priority,
          jsonb_build_object(
            'load_order_id', lo.load_order_id,
            'factory_name', f.name,
            'quarry_name', q.name,
            'requested_quantity', lo.requested_quantity,
            'status', lo.status,
            'priority', lo.priority,
            'created_at', lo.created_at,
            'published_at', lo.published_at,
            'committed_quantity', COALESCE((
              SELECT count(*) FROM public.bookings b
              WHERE b.load_order_id = lo.load_order_id
                AND b.status IN ('BOOKED','LOADING_STATEMENT','IN_TRANSIT','DELIVERED','COMPLETED')
            ), 0)
          ) AS item
        FROM public.load_orders lo
        JOIN public.factories f ON f.factory_id = lo.factory_id
        JOIN public.quarries q ON q.quarry_id = lo.quarry_id
        WHERE lo.office_id = v_head_office_id
          AND lo.check_in_office_id = v_branch_office_id
          AND lo.status IN ('PUBLISHED','LOADING_STATEMENT')
        ORDER BY lo.priority DESC, lo.created_at ASC
        LIMIT 150
      ) x
    ), '[]'::jsonb),
    'allocations', COALESCE((
      SELECT jsonb_agg(x.item ORDER BY x.booked_at DESC)
      FROM (
        SELECT b.booked_at,
          jsonb_build_object(
            'booking_id', b.booking_id,
            'trip_code', b.trip_code,
            'assignment_sequence_date', b.assignment_sequence_date,
            'assignment_daily_number', b.assignment_daily_number,
            'status', b.status,
            'booked_at', b.booked_at,
            'driver_name', d.name,
            'driver_phone', d.phone,
            'plate_number', v.plate_number,
            'vehicle_code', v.vehicle_code,
            'owner_name', vo.name,
            'owner_phone', vo.phone,
            'factory_name', f.name,
            'quarry_name', q.name,
            'actual_weight', alr.actual_weight,
            'delivery_confirmed_at', alr.delivery_confirmed_at
          ) AS item
        FROM public.bookings b
        LEFT JOIN public.load_orders lo ON lo.load_order_id = b.load_order_id
        LEFT JOIN public.standalone_direct_load_audit sda ON sda.booking_id = b.booking_id
        JOIN public.drivers d ON d.driver_id = b.driver_id
        JOIN public.vehicles v ON v.vehicle_id = b.vehicle_id
        LEFT JOIN public.vehicle_owners vo ON vo.owner_id = v.owner_id
        JOIN public.factories f ON f.factory_id = COALESCE(lo.factory_id, sda.factory_id)
        JOIN public.quarries q ON q.quarry_id = COALESCE(lo.quarry_id, sda.quarry_id)
        LEFT JOIN public.actual_loading_records alr ON alr.booking_id = b.booking_id
        WHERE (
            (lo.office_id = v_head_office_id AND lo.check_in_office_id = v_branch_office_id)
            OR (lo.load_order_id IS NULL AND sda.office_id = v_branch_office_id)
          )
          AND b.status NOT IN ('CANCELLED','REJECTED','NO_SHOW','FAILED')
        ORDER BY b.booked_at DESC
        LIMIT 300
      ) x
    ), '[]'::jsonb),
    'waiting_list', COALESCE((
      SELECT jsonb_agg(x.item ORDER BY x.arrived_at ASC)
      FROM (
        SELECT w.arrived_at,
          jsonb_build_object(
            'entry_id', w.entry_id,
            'status', w.status,
            'arrived_at', w.arrived_at,
            'driver_name', d.name,
            'driver_phone', d.phone,
            'plate_number', v.plate_number,
            'vehicle_code', v.vehicle_code,
            'owner_name', vo.name,
            'owner_phone', vo.phone
          ) AS item
        FROM public.waiting_list_entries w
        JOIN public.drivers d ON d.driver_id = w.driver_id
        JOIN public.vehicles v ON v.vehicle_id = w.vehicle_id
        LEFT JOIN public.vehicle_owners vo ON vo.owner_id = v.owner_id
        WHERE w.office_id = v_branch_office_id
          AND w.status IN ('WAITING','SELECTED','ASSIGNED')
        ORDER BY w.arrived_at ASC
        LIMIT 300
      ) x
    ), '[]'::jsonb),
    'directory', COALESCE((
      SELECT jsonb_agg(x.item ORDER BY x.driver_name)
      FROM (
        SELECT d.name AS driver_name,
          jsonb_build_object(
            'driver_id', d.driver_id,
            'driver_name', d.name,
            'driver_phone', d.phone,
            'driver_code', d.driver_code,
            'plate_number', v.plate_number,
            'vehicle_code', v.vehicle_code,
            'owner_name', vo.name,
            'owner_phone', vo.phone
          ) AS item
        FROM public.drivers d
        LEFT JOIN public.vehicle_driver_assignments vda
          ON vda.driver_id = d.driver_id AND vda.assigned_to IS NULL
        LEFT JOIN public.vehicles v ON v.vehicle_id = vda.vehicle_id
        LEFT JOIN public.vehicle_owners vo ON vo.owner_id = v.owner_id
        WHERE d.is_active = true AND EXISTS (SELECT 1 FROM public.driver_office_assignments doa WHERE doa.driver_id = d.driver_id AND doa.office_id = v_branch_office_id AND doa.assigned_to IS NULL AND doa.assigned_from <= now())
        ORDER BY d.name
        LIMIT 500
      ) x
    ), '[]'::jsonb)
  );
END;
$function$


-- Preserve explicit API exposure only for authenticated callers.
REVOKE ALL ON FUNCTION public.get_branch_office_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_branch_office_snapshot() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_branch_office_snapshot() TO authenticated;
