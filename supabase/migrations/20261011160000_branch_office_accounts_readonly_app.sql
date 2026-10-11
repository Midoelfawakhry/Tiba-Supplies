-- Phase 1: branch office employee accounts and a dedicated read-only branch snapshot.
-- Candidate migration only. Do not apply to production until isolated staging gates pass.

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(office_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_users_username_ci
  ON public.app_users (lower(username))
  WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_office_active
  ON public.app_users (office_id, is_active);

-- Branch users must not receive the main-office snapshot.
CREATE OR REPLACE FUNCTION public.get_phase1_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_operational_office_id uuid;
  v_check_in_office_id uuid;
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
      AND r.name IN ('ADMIN', 'HEAD_OFFICE')
  ) THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE';
  END IF;

  SELECT o.office_id INTO v_operational_office_id
  FROM public.offices o
  WHERE o.is_active = true AND o.office_type = 'HEAD'
  ORDER BY o.created_at, o.name
  LIMIT 1;

  SELECT o.office_id INTO v_check_in_office_id
  FROM public.offices o
  WHERE o.is_active = true AND o.office_type = 'BRANCH'
  ORDER BY o.name
  LIMIT 1;

  IF v_operational_office_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_HEAD_OFFICE_NOT_CONFIGURED';
  END IF;
  IF v_check_in_office_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_CHECK_IN_OFFICE_NOT_CONFIGURED';
  END IF;

  RETURN jsonb_build_object(
    'office', (SELECT to_jsonb(o) FROM public.offices o WHERE o.office_id = v_operational_office_id),
    'operational_office', (SELECT to_jsonb(o) FROM public.offices o WHERE o.office_id = v_operational_office_id),
    'check_in_office', (SELECT to_jsonb(o) FROM public.offices o WHERE o.office_id = v_check_in_office_id),
    'factories', COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.name) FROM public.factories f WHERE f.is_active), '[]'::jsonb),
    'quarries', COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.name) FROM public.quarries q WHERE q.is_active), '[]'::jsonb),
    'load_orders', COALESCE((SELECT jsonb_agg(to_jsonb(lo) ORDER BY lo.created_at DESC) FROM public.load_orders lo WHERE lo.office_id = v_operational_office_id), '[]'::jsonb),
    'bookings', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.booked_at DESC) FROM public.bookings b JOIN public.load_orders lo ON lo.load_order_id = b.load_order_id WHERE lo.office_id = v_operational_office_id), '[]'::jsonb),
    'actual_loading_records', COALESCE((SELECT jsonb_agg(to_jsonb(alr) ORDER BY alr.created_at DESC) FROM public.actual_loading_records alr JOIN public.bookings b ON b.booking_id = alr.booking_id JOIN public.load_orders lo ON lo.load_order_id = b.load_order_id WHERE lo.office_id = v_operational_office_id), '[]'::jsonb),
    'drivers', COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.name) FROM public.drivers d WHERE d.is_active), '[]'::jsonb),
    'vehicles', COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.plate_number) FROM public.vehicles v WHERE v.is_active), '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_phase1_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_phase1_snapshot() TO authenticated;

-- The branch snapshot deliberately returns only branch-relevant operational read models.
CREATE OR REPLACE FUNCTION public.get_branch_office_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        JOIN public.load_orders lo ON lo.load_order_id = b.load_order_id
        LEFT JOIN public.drivers d ON d.driver_id = alr.driver_id
        LEFT JOIN public.vehicles v ON v.vehicle_id = alr.vehicle_id
        LEFT JOIN public.factories f ON f.factory_id = alr.factory_id
        LEFT JOIN public.quarries q ON q.quarry_id = alr.quarry_id
        WHERE lo.office_id = v_head_office_id
          AND lo.check_in_office_id = v_branch_office_id
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
        JOIN public.load_orders lo ON lo.load_order_id = b.load_order_id
        JOIN public.drivers d ON d.driver_id = b.driver_id
        JOIN public.vehicles v ON v.vehicle_id = b.vehicle_id
        LEFT JOIN public.vehicle_owners vo ON vo.owner_id = v.owner_id
        JOIN public.factories f ON f.factory_id = lo.factory_id
        JOIN public.quarries q ON q.quarry_id = lo.quarry_id
        LEFT JOIN public.actual_loading_records alr ON alr.booking_id = b.booking_id
        WHERE lo.office_id = v_head_office_id
          AND lo.check_in_office_id = v_branch_office_id
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
        WHERE d.is_active = true
        ORDER BY d.name
        LIMIT 500
      ) x
    ), '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_branch_office_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_branch_office_snapshot() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_branch_employee_directory()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_auth uuid := auth.uid();
BEGIN
  IF v_auth IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id=au.user_id
    JOIN public.roles r ON r.role_id=ur.role_id
    WHERE au.auth_user_id=v_auth AND au.is_active
      AND r.name IN ('ADMIN','HEAD_OFFICE')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'user_id', au.user_id,
      'username', au.username,
      'display_name', au.display_name,
      'phone', au.phone,
      'is_active', au.is_active,
      'created_at', au.created_at,
      'office_name', o.name
    ) ORDER BY au.created_at DESC)
    FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id=au.user_id
    JOIN public.roles r ON r.role_id=ur.role_id AND r.name='BRANCH'
    LEFT JOIN public.offices o ON o.office_id=au.office_id
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_branch_employee_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_branch_employee_directory() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_branch_employee_active(
  p_user_id uuid,
  p_is_active boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth uuid := auth.uid();
  v_actor uuid;
  v_target public.app_users%ROWTYPE;
BEGIN
  IF v_auth IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT au.user_id INTO v_actor
  FROM public.app_users au
  JOIN public.user_roles ur ON ur.user_id=au.user_id
  JOIN public.roles r ON r.role_id=ur.role_id
  WHERE au.auth_user_id=v_auth AND au.is_active
    AND r.name IN ('ADMIN','HEAD_OFFICE')
  LIMIT 1;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;

  SELECT * INTO v_target FROM public.app_users WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.role_id=ur.role_id
    WHERE ur.user_id=p_user_id AND r.name='BRANCH'
  ) THEN RAISE EXCEPTION 'BRANCH_EMPLOYEE_NOT_FOUND'; END IF;

  UPDATE public.app_users SET is_active=p_is_active WHERE user_id=p_user_id;
  INSERT INTO public.audit_log(actor_user_id, action, entity_type, entity_id, old_data, new_data)
  VALUES(v_actor, CASE WHEN p_is_active THEN 'BRANCH_EMPLOYEE_ACTIVATED' ELSE 'BRANCH_EMPLOYEE_DEACTIVATED' END,
    'app_user', p_user_id::text,
    jsonb_build_object('is_active',v_target.is_active,'username',v_target.username,'office_id',v_target.office_id),
    jsonb_build_object('is_active',p_is_active,'username',v_target.username,'office_id',v_target.office_id));
  RETURN jsonb_build_object('success',true,'user_id',p_user_id,'is_active',p_is_active);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_branch_employee_active(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_branch_employee_active(uuid,boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
