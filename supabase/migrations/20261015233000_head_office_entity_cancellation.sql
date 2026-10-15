-- Head-office entity cancellation is a reversible deactivation, never a hard delete.
-- The UI must require two confirmations and the exact Arabic confirmation phrase.
CREATE TABLE IF NOT EXISTS public.office_entity_cancellation_audit (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('driver','factory','quarry','vehicle','owner')),
  entity_id uuid NOT NULL,
  entity_label text NOT NULL,
  reason text NOT NULL,
  cancelled_by_auth_user_id uuid NOT NULL,
  cancelled_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.office_entity_cancellation_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_entity_cancellation_audit FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.office_cancel_entity(
  p_entity_type text,
  p_entity_id uuid,
  p_entity_label text,
  p_reason text,
  p_confirmation_phrase text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_table text;
  v_key text;
  v_rows integer;
  v_label text := NULLIF(btrim(p_entity_label), '');
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_confirmation_phrase IS DISTINCT FROM 'إلغاء' THEN
    RAISE EXCEPTION 'CANCELLATION_CONFIRMATION_REQUIRED';
  END IF;
  IF v_label IS NULL OR v_reason IS NULL THEN
    RAISE EXCEPTION 'CANCELLATION_DETAILS_REQUIRED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users au
    JOIN public.user_roles ur ON ur.user_id = au.user_id
    JOIN public.roles r ON r.role_id = ur.role_id
    WHERE au.auth_user_id = v_uid AND au.is_active = true
      AND r.name IN ('ADMIN','HEAD_OFFICE')
  ) THEN RAISE EXCEPTION 'INSUFFICIENT_ROLE'; END IF;

  CASE p_entity_type
    WHEN 'driver' THEN v_table := 'drivers'; v_key := 'driver_id';
    WHEN 'factory' THEN v_table := 'factories'; v_key := 'factory_id';
    WHEN 'quarry' THEN v_table := 'quarries'; v_key := 'quarry_id';
    WHEN 'vehicle' THEN v_table := 'vehicles'; v_key := 'vehicle_id';
    WHEN 'owner' THEN v_table := 'vehicle_owners'; v_key := 'owner_id';
    ELSE RAISE EXCEPTION 'UNSUPPORTED_ENTITY_TYPE';
  END CASE;

  IF p_entity_type = 'owner' AND EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.owner_id = p_entity_id AND v.is_active = true
  ) THEN RAISE EXCEPTION 'OWNER_HAS_ACTIVE_VEHICLES'; END IF;

  IF p_entity_type = 'vehicle' AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.vehicle_id = p_entity_id
      AND upper(coalesce(b.status::text,'')) IN ('BOOKED','LOADING_STATEMENT','IN_TRANSIT','ACCEPTED')
  ) THEN RAISE EXCEPTION 'ENTITY_HAS_ACTIVE_BOOKING'; END IF;

  IF p_entity_type = 'driver' AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.driver_id = p_entity_id
      AND upper(coalesce(b.status::text,'')) IN ('BOOKED','LOADING_STATEMENT','IN_TRANSIT','ACCEPTED')
  ) THEN RAISE EXCEPTION 'ENTITY_HAS_ACTIVE_BOOKING'; END IF;

  IF p_entity_type = 'factory' AND EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.load_orders lo ON lo.load_order_id = b.load_order_id
    WHERE lo.factory_id = p_entity_id
      AND upper(coalesce(b.status::text,'')) IN ('BOOKED','LOADING_STATEMENT','IN_TRANSIT','ACCEPTED')
  ) THEN RAISE EXCEPTION 'ENTITY_HAS_ACTIVE_BOOKING'; END IF;

  IF p_entity_type = 'quarry' AND EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.load_orders lo ON lo.load_order_id = b.load_order_id
    WHERE lo.quarry_id = p_entity_id
      AND upper(coalesce(b.status::text,'')) IN ('BOOKED','LOADING_STATEMENT','IN_TRANSIT','ACCEPTED')
  ) THEN RAISE EXCEPTION 'ENTITY_HAS_ACTIVE_BOOKING'; END IF;

  EXECUTE format('UPDATE public.%I SET is_active = false WHERE %I = $1 AND is_active = true', v_table, v_key)
    USING p_entity_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'ENTITY_NOT_FOUND_OR_ALREADY_INACTIVE'; END IF;

  INSERT INTO public.office_entity_cancellation_audit
    (entity_type, entity_id, entity_label, reason, cancelled_by_auth_user_id)
  VALUES (p_entity_type, p_entity_id, v_label, v_reason, v_uid);

  RETURN jsonb_build_object('success', true, 'entity_type', p_entity_type, 'entity_id', p_entity_id, 'is_active', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.office_cancel_entity(text, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_cancel_entity(text, uuid, text, text, text) TO authenticated;
