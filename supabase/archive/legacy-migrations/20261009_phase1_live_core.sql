-- Phase 1 live core: single source of truth for the operations dashboard.
-- Apply this in Supabase SQL Editor before using the live dashboard.

CREATE OR REPLACE FUNCTION public.get_phase1_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
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

  RETURN jsonb_build_object(
    'office',
      (
        SELECT to_jsonb(o)
        FROM public.offices o
        WHERE o.is_active = true
          AND o.office_type = 'BRANCH'
        ORDER BY o.name
        LIMIT 1
      ),
    'factories',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.name)
         FROM public.factories f
         WHERE f.is_active = true),
        '[]'::jsonb
      ),
    'quarries',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(q))
         FROM public.quarries q
         WHERE q.is_active = true),
        '[]'::jsonb
      ),
    'load_orders',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(lo) ORDER BY lo.created_at DESC)
         FROM public.load_orders lo
         WHERE lo.office_id = (
           SELECT o.office_id
           FROM public.offices o
           WHERE o.is_active = true
             AND o.office_type = 'BRANCH'
           ORDER BY o.name
           LIMIT 1
         )),
        '[]'::jsonb
      ),
    'bookings',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(b) ORDER BY b.booked_at DESC)
         FROM public.bookings b
         JOIN public.load_orders lo ON lo.load_order_id = b.load_order_id
         WHERE lo.office_id = (
           SELECT o.office_id
           FROM public.offices o
           WHERE o.is_active = true
             AND o.office_type = 'BRANCH'
           ORDER BY o.name
           LIMIT 1
         )),
        '[]'::jsonb
      ),
    'actual_loading_records',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(alr) ORDER BY alr.created_at DESC)
         FROM public.actual_loading_records alr
         JOIN public.load_orders lo ON lo.factory_id = alr.factory_id
                              AND lo.quarry_id = alr.quarry_id
         WHERE lo.office_id = (
           SELECT o.office_id
           FROM public.offices o
           WHERE o.is_active = true
             AND o.office_type = 'BRANCH'
           ORDER BY o.name
           LIMIT 1
         )),
        '[]'::jsonb
      ),
    'drivers',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(d) ORDER BY d.name)
         FROM public.drivers d
         WHERE d.is_active = true),
        '[]'::jsonb
      ),
    'vehicles',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(v) ORDER BY v.plate_number)
         FROM public.vehicles v
         WHERE v.is_active = true),
        '[]'::jsonb
      )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_phase1_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_phase1_snapshot() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_phase1_snapshot() TO authenticated;
