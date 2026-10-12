-- Phase 1: head-office-only create/update for the master data directory.
-- This migration is a candidate and must be reviewed/tested before production application.
-- No existing rows are changed by this migration.
CREATE OR REPLACE FUNCTION public.save_master_directory_entry(
  p_entity_type text,
  p_entity_id uuid,
  p_name text,
  p_code text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_is_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_name text := NULLIF(btrim(p_name), '');
  v_code text := NULLIF(upper(btrim(p_code)), '');
  v_address text := NULLIF(btrim(p_address), '');
  v_phone text := NULLIF(btrim(p_phone), '');
  v_id uuid;
  v_existing_id uuid;
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

  IF p_entity_type NOT IN ('factory', 'quarry') THEN
    RAISE EXCEPTION 'INVALID_DIRECTORY_ENTITY_TYPE';
  END IF;
  IF v_name IS NULL THEN RAISE EXCEPTION 'DIRECTORY_NAME_REQUIRED'; END IF;

  -- Serialize writes for the same normalized code to prevent concurrent duplicate inserts.
  IF v_code IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('master-directory:' || p_entity_type || ':' || v_code));
  END IF;

  IF p_entity_type = 'factory' THEN
    IF v_code IS NOT NULL THEN
      SELECT f.factory_id INTO v_existing_id
      FROM public.factories f
      WHERE upper(btrim(f.code)) = v_code
        AND (p_entity_id IS NULL OR f.factory_id <> p_entity_id)
      LIMIT 1;
      IF v_existing_id IS NOT NULL THEN RAISE EXCEPTION 'DIRECTORY_CODE_EXISTS'; END IF;
    END IF;

    IF p_entity_id IS NULL THEN
      INSERT INTO public.factories (name, code, address, phone, is_active)
      VALUES (v_name, v_code, v_address, v_phone, COALESCE(p_is_active, true))
      RETURNING factory_id INTO v_id;
    ELSE
      UPDATE public.factories
      SET name = v_name, code = v_code, address = v_address, phone = v_phone,
          is_active = COALESCE(p_is_active, true)
      WHERE factory_id = p_entity_id
      RETURNING factory_id INTO v_id;
      IF v_id IS NULL THEN RAISE EXCEPTION 'DIRECTORY_ENTRY_NOT_FOUND'; END IF;
    END IF;
  ELSE
    IF v_code IS NOT NULL THEN
      SELECT q.quarry_id INTO v_existing_id
      FROM public.quarries q
      WHERE upper(btrim(q.code)) = v_code
        AND (p_entity_id IS NULL OR q.quarry_id <> p_entity_id)
      LIMIT 1;
      IF v_existing_id IS NOT NULL THEN RAISE EXCEPTION 'DIRECTORY_CODE_EXISTS'; END IF;
    END IF;

    IF p_entity_id IS NULL THEN
      INSERT INTO public.quarries (name, code, address, phone, is_active)
      VALUES (v_name, v_code, v_address, v_phone, COALESCE(p_is_active, true))
      RETURNING quarry_id INTO v_id;
    ELSE
      UPDATE public.quarries
      SET name = v_name, code = v_code, address = v_address, phone = v_phone,
          is_active = COALESCE(p_is_active, true)
      WHERE quarry_id = p_entity_id
      RETURNING quarry_id INTO v_id;
      IF v_id IS NULL THEN RAISE EXCEPTION 'DIRECTORY_ENTRY_NOT_FOUND'; END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'entity_type', p_entity_type,
    'entity_id', v_id,
    'name', v_name,
    'code', v_code
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_master_directory_entry(text, uuid, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_master_directory_entry(text, uuid, text, text, text, text, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
