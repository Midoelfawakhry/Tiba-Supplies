-- Phase 1: weight-only trip identity and daily Loading Data sequence.
-- Candidate migration: review and validate in isolated staging before production.
-- No monetary columns, prices, balances, or payment logic are introduced.

CREATE TABLE IF NOT EXISTS public.daily_loading_counters (
  loading_date date PRIMARY KEY,
  last_number bigint NOT NULL CHECK (last_number >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.daily_loading_counters FROM PUBLIC, anon, authenticated;

ALTER TABLE public.actual_loading_records
  ADD COLUMN IF NOT EXISTS trip_code text,
  ADD COLUMN IF NOT EXISTS daily_load_number bigint,
  ADD COLUMN IF NOT EXISTS loading_sequence_date date;

-- Stable one-time backfill for existing loading rows, ordered deterministically.
WITH numbered AS (
  SELECT
    alr.actual_load_id,
    COALESCE(alr.load_date, alr.created_at::date, CURRENT_DATE) AS sequence_date,
    row_number() OVER (
      PARTITION BY COALESCE(alr.load_date, alr.created_at::date, CURRENT_DATE)
      ORDER BY alr.created_at, alr.actual_load_id
    )::bigint AS day_number
  FROM public.actual_loading_records alr
)
UPDATE public.actual_loading_records alr
SET loading_sequence_date = n.sequence_date,
    daily_load_number = n.day_number,
    trip_code = format('TIBA-%s-%s', to_char(n.sequence_date, 'YYYYMMDD'), lpad(n.day_number::text, 6, '0'))
FROM numbered n
WHERE n.actual_load_id = alr.actual_load_id
  AND (alr.trip_code IS NULL OR alr.daily_load_number IS NULL OR alr.loading_sequence_date IS NULL);

INSERT INTO public.daily_loading_counters (loading_date, last_number)
SELECT loading_sequence_date, max(daily_load_number)
FROM public.actual_loading_records
GROUP BY loading_sequence_date
ON CONFLICT (loading_date) DO UPDATE
SET last_number = GREATEST(public.daily_loading_counters.last_number, EXCLUDED.last_number),
    updated_at = now();

ALTER TABLE public.actual_loading_records
  ALTER COLUMN trip_code SET NOT NULL,
  ALTER COLUMN daily_load_number SET NOT NULL,
  ALTER COLUMN loading_sequence_date SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_actual_loading_records_trip_code
  ON public.actual_loading_records (trip_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_actual_loading_records_daily_number
  ON public.actual_loading_records (loading_sequence_date, daily_load_number);

CREATE OR REPLACE FUNCTION public.assign_actual_loading_trip_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_date date;
  v_number bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_date := COALESCE(NEW.load_date, NEW.created_at::date, CURRENT_DATE);
    INSERT INTO public.daily_loading_counters (loading_date, last_number)
    VALUES (v_date, 1)
    ON CONFLICT (loading_date) DO UPDATE
      SET last_number = public.daily_loading_counters.last_number + 1,
          updated_at = now()
    RETURNING last_number INTO v_number;

    NEW.loading_sequence_date := v_date;
    NEW.daily_load_number := v_number;
    NEW.trip_code := format('TIBA-%s-%s', to_char(v_date, 'YYYYMMDD'), lpad(v_number::text, 6, '0'));
    RETURN NEW;
  END IF;

  IF NEW.trip_code IS DISTINCT FROM OLD.trip_code
     OR NEW.daily_load_number IS DISTINCT FROM OLD.daily_load_number
     OR NEW.loading_sequence_date IS DISTINCT FROM OLD.loading_sequence_date THEN
    RAISE EXCEPTION 'TRIP_IDENTITY_IS_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_assign_actual_loading_trip_code ON public.actual_loading_records;
CREATE TRIGGER trg_assign_actual_loading_trip_code
BEFORE INSERT OR UPDATE OF trip_code, daily_load_number, loading_sequence_date
ON public.actual_loading_records
FOR EACH ROW
EXECUTE FUNCTION public.assign_actual_loading_trip_code();

REVOKE ALL ON FUNCTION public.assign_actual_loading_trip_code() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_account_statement_records(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_auth_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_auth_user_id
      AND au.is_active = true
      AND r.name IN ('ADMIN', 'HEAD_OFFICE')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
    RAISE EXCEPTION 'INVALID_DATE_RANGE';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'actual_load_id', alr.actual_load_id,
    'booking_id', alr.booking_id,
    'trip_code', alr.trip_code,
    'daily_load_number', alr.daily_load_number,
    'loading_sequence_date', alr.loading_sequence_date,
    'load_date', alr.load_date,
    'created_at', alr.created_at,
    'ticket_number', alr.ticket_number,
    'actual_weight', alr.actual_weight,
    'vehicle_id', alr.vehicle_id,
    'plate_number', v.plate_number,
    'driver_id', alr.driver_id,
    'driver_name', d.name,
    'factory_id', alr.factory_id,
    'factory_name', f.name,
    'quarry_id', alr.quarry_id,
    'quarry_name', q.name,
    'delivery_confirmed_at', alr.delivery_confirmed_at
  ) ORDER BY alr.loading_sequence_date DESC, alr.daily_load_number DESC), '[]'::jsonb)
  INTO v_result
  FROM public.actual_loading_records alr
  LEFT JOIN public.vehicles v ON v.vehicle_id = alr.vehicle_id
  LEFT JOIN public.drivers d ON d.driver_id = alr.driver_id
  LEFT JOIN public.factories f ON f.factory_id = alr.factory_id
  LEFT JOIN public.quarries q ON q.quarry_id = alr.quarry_id
  WHERE (p_from IS NULL OR alr.loading_sequence_date >= p_from)
    AND (p_to IS NULL OR alr.loading_sequence_date <= p_to);

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_account_statement_records(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_account_statement_records(date,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_vehicle_owner_reports(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_auth_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_auth_user_id AND au.is_active = true
      AND r.name IN ('ADMIN', 'HEAD_OFFICE')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from > p_to THEN
    RAISE EXCEPTION 'INVALID_DATE_RANGE';
  END IF;

  SELECT jsonb_build_object(
    'vehicles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'vehicle_id',v.vehicle_id,'plate_number',v.plate_number,'vehicle_code',v.vehicle_code,
        'owner_id',vo.owner_id,'owner_name',vo.name,'owner_phone',vo.phone,'is_active',v.is_active
      ) ORDER BY v.plate_number)
      FROM public.vehicles v LEFT JOIN public.vehicle_owners vo ON vo.owner_id=v.owner_id
    ), '[]'::jsonb),
    'owners', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'owner_id',vo.owner_id,'name',vo.name,'phone',vo.phone,'is_active',vo.is_active,
        'vehicle_count',(SELECT count(*) FROM public.vehicles v2 WHERE v2.owner_id=vo.owner_id)
      ) ORDER BY vo.name)
      FROM public.vehicle_owners vo
    ), '[]'::jsonb),
    'trips', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'actual_load_id',alr.actual_load_id,'booking_id',alr.booking_id,
        'trip_code',alr.trip_code,'daily_load_number',alr.daily_load_number,
        'loading_sequence_date',alr.loading_sequence_date,
        'load_date',alr.load_date,'created_at',alr.created_at,
        'vehicle_id',alr.vehicle_id,'plate_number',v.plate_number,'vehicle_code',v.vehicle_code,
        'owner_id',v.owner_id,'owner_name',vo.name,
        'driver_id',alr.driver_id,'driver_name',d.name,
        'quarry_id',alr.quarry_id,'quarry_name',q.name,
        'factory_id',alr.factory_id,'factory_name',f.name,
        'ticket_number',alr.ticket_number,'actual_weight',alr.actual_weight,
        'scale_image_path',alr.scale_image_path,'delivery_confirmed_at',alr.delivery_confirmed_at,
        'booking_status',b.status,
        'is_completed',(alr.delivery_confirmed_at IS NOT NULL AND alr.actual_weight IS NOT NULL)
      ) ORDER BY alr.loading_sequence_date DESC, alr.daily_load_number DESC)
      FROM public.actual_loading_records alr
      LEFT JOIN public.vehicles v ON v.vehicle_id=alr.vehicle_id
      LEFT JOIN public.vehicle_owners vo ON vo.owner_id=v.owner_id
      LEFT JOIN public.drivers d ON d.driver_id=alr.driver_id
      LEFT JOIN public.quarries q ON q.quarry_id=alr.quarry_id
      LEFT JOIN public.factories f ON f.factory_id=alr.factory_id
      LEFT JOIN public.bookings b ON b.booking_id=alr.booking_id
      WHERE (p_from IS NULL OR alr.loading_sequence_date>=p_from)
        AND (p_to IS NULL OR alr.loading_sequence_date<=p_to)
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_vehicle_owner_reports(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_owner_reports(date,date) TO authenticated;

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
            OR (lo.load_order_id IS NULL AND sda.office_id = v_head_office_id)
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
            OR (lo.load_order_id IS NULL AND sda.office_id = v_head_office_id)
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
        WHERE d.is_active = true
        ORDER BY d.name
        LIMIT 500
      ) x
    ), '[]'::jsonb)
  );
END;
$function$;



NOTIFY pgrst, 'reload schema';
