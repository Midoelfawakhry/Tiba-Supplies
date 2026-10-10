-- Phase 1: create and publish a load order from the active HEAD office.
-- This migration does not create bookings or driver/vehicle assignments.

CREATE OR REPLACE FUNCTION public.create_load_order(
  p_factory_id uuid,
  p_quarry_id uuid,
  p_requested_quantity integer,
  p_priority integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_operational_office_id uuid;
  v_check_in_office_id uuid;
  v_load_order public.load_orders%rowtype;
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

  IF p_requested_quantity IS NULL OR p_requested_quantity <= 0 THEN
    RAISE EXCEPTION 'INVALID_REQUESTED_QUANTITY';
  END IF;

  IF p_priority IS NULL OR p_priority < 1 OR p_priority > 5 THEN
    RAISE EXCEPTION 'INVALID_PRIORITY';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.factories f
    WHERE f.factory_id = p_factory_id AND f.is_active = true
  ) THEN
    RAISE EXCEPTION 'FACTORY_NOT_FOUND_OR_INACTIVE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.quarries q
    WHERE q.quarry_id = p_quarry_id AND q.is_active = true
  ) THEN
    RAISE EXCEPTION 'QUARRY_NOT_FOUND_OR_INACTIVE';
  END IF;

  SELECT o.office_id
  INTO v_operational_office_id
  FROM public.offices o
  WHERE o.is_active = true AND o.office_type = 'HEAD'
  ORDER BY o.created_at, o.name
  LIMIT 1;

  IF v_operational_office_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_HEAD_OFFICE_NOT_CONFIGURED';
  END IF;

  SELECT o.office_id
  INTO v_check_in_office_id
  FROM public.offices o
  WHERE o.is_active = true AND o.office_type = 'BRANCH'
  ORDER BY o.name
  LIMIT 1;

  IF v_check_in_office_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_CHECK_IN_OFFICE_NOT_CONFIGURED';
  END IF;

  INSERT INTO public.load_orders (
    office_id,
    check_in_office_id,
    factory_id,
    quarry_id,
    requested_quantity,
    status,
    priority,
    published_at
  )
  VALUES (
    v_operational_office_id,
    v_check_in_office_id,
    p_factory_id,
    p_quarry_id,
    p_requested_quantity,
    'PUBLISHED',
    p_priority,
    now()
  )
  RETURNING * INTO v_load_order;

  RETURN jsonb_build_object(
    'success', true,
    'load_order', to_jsonb(v_load_order)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_load_order(uuid, uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_load_order(uuid, uuid, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_load_order(uuid, uuid, integer, integer) TO authenticated;
