-- Phase 1: head-office-only create/update for the master data directory.
-- Candidate migration: review and validate before production application.
-- Adds nullable metadata only; existing factory/quarry rows are preserved.
ALTER TABLE public.factories ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.factories ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.quarries ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.quarries ADD COLUMN IF NOT EXISTS phone text;

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
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_actor uuid;
  v_name text := NULLIF(btrim(p_name), '');
  v_code text := NULLIF(upper(btrim(p_code)), '');
  v_address text := NULLIF(btrim(p_address), '');
  v_phone text := NULLIF(btrim(p_phone), '');
  v_is_active boolean := COALESCE(p_is_active, true);
  v_id uuid;
  v_existing_id uuid;
  v_old_data jsonb;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT au.user_id INTO v_actor
  FROM public.app_users au
  JOIN public.user_roles ur ON ur.user_id = au.user_id
  JOIN public.roles r ON r.role_id = ur.role_id
  WHERE au.auth_user_id = v_auth_user_id
    AND au.is_active = true
    AND r.name IN ('ADMIN', 'HEAD_OFFICE')
  LIMIT 1;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE';
  END IF;

  IF p_entity_type IS NULL OR p_entity_type NOT IN ('factory', 'quarry') THEN
    RAISE EXCEPTION 'INVALID_DIRECTORY_ENTITY_TYPE';
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'DIRECTORY_NAME_REQUIRED';
  END IF;

  -- Serialize writes for a normalized code, preventing concurrent duplicate inserts.
  IF v_code IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('master-directory:' || p_entity_type || ':code:' || v_code));
  END IF;
  -- Names are unique in each directory table. Lock by exact name to improve concurrent-write feedback.
  PERFORM pg_advisory_xact_lock(hashtext('master-directory:' || p_entity_type || ':name:' || lower(v_name)));

  IF p_entity_type = 'factory' THEN
    IF EXISTS (
      SELECT 1 FROM public.factories f
      WHERE lower(btrim(f.name)) = lower(v_name)
        AND (p_entity_id IS NULL OR f.factory_id <> p_entity_id)
    ) THEN
      RAISE EXCEPTION 'DIRECTORY_NAME_EXISTS';
    END IF;

    IF v_code IS NOT NULL THEN
      SELECT f.factory_id INTO v_existing_id
      FROM public.factories f
      WHERE upper(btrim(f.code)) = v_code
        AND (p_entity_id IS NULL OR f.factory_id <> p_entity_id)
      LIMIT 1;
      IF v_existing_id IS NOT NULL THEN
        RAISE EXCEPTION 'DIRECTORY_CODE_EXISTS';
      END IF;
    END IF;

    IF p_entity_id IS NULL THEN
      INSERT INTO public.factories (name, code, address, phone, is_active)
      VALUES (v_name, v_code, v_address, v_phone, v_is_active)
      RETURNING factory_id INTO v_id;
    ELSE
      SELECT jsonb_build_object(
        'name', f.name, 'code', f.code, 'address', f.address,
        'phone', f.phone, 'is_active', f.is_active
      ) INTO v_old_data
      FROM public.factories f
      WHERE f.factory_id = p_entity_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'DIRECTORY_ENTRY_NOT_FOUND';
      END IF;

      UPDATE public.factories
      SET name = v_name, code = v_code, address = v_address, phone = v_phone,
          is_active = v_is_active
      WHERE factory_id = p_entity_id
      RETURNING factory_id INTO v_id;
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.quarries q
      WHERE lower(btrim(q.name)) = lower(v_name)
        AND (p_entity_id IS NULL OR q.quarry_id <> p_entity_id)
    ) THEN
      RAISE EXCEPTION 'DIRECTORY_NAME_EXISTS';
    END IF;

    IF v_code IS NOT NULL THEN
      SELECT q.quarry_id INTO v_existing_id
      FROM public.quarries q
      WHERE upper(btrim(q.code)) = v_code
        AND (p_entity_id IS NULL OR q.quarry_id <> p_entity_id)
      LIMIT 1;
      IF v_existing_id IS NOT NULL THEN
        RAISE EXCEPTION 'DIRECTORY_CODE_EXISTS';
      END IF;
    END IF;

    IF p_entity_id IS NULL THEN
      INSERT INTO public.quarries (name, code, address, phone, is_active)
      VALUES (v_name, v_code, v_address, v_phone, v_is_active)
      RETURNING quarry_id INTO v_id;
    ELSE
      SELECT jsonb_build_object(
        'name', q.name, 'code', q.code, 'address', q.address,
        'phone', q.phone, 'is_active', q.is_active
      ) INTO v_old_data
      FROM public.quarries q
      WHERE q.quarry_id = p_entity_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'DIRECTORY_ENTRY_NOT_FOUND';
      END IF;

      UPDATE public.quarries
      SET name = v_name, code = v_code, address = v_address, phone = v_phone,
          is_active = v_is_active
      WHERE quarry_id = p_entity_id
      RETURNING quarry_id INTO v_id;
    END IF;
  END IF;

  INSERT INTO public.audit_log (
    actor_user_id, action, entity_type, entity_id, old_data, new_data
  )
  VALUES (
    v_actor,
    CASE WHEN v_old_data IS NULL THEN 'MASTER_DIRECTORY_ENTRY_CREATED'
         ELSE 'MASTER_DIRECTORY_ENTRY_UPDATED' END,
    p_entity_type,
    v_id::text,
    v_old_data,
    jsonb_build_object(
      'name', v_name, 'code', v_code, 'address', v_address,
      'phone', v_phone, 'is_active', v_is_active
    )
  );

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

-- Trigger-only function: it must not be directly callable through PostgREST RPC.
REVOKE ALL ON FUNCTION public.auto_assign_driver_to_ras_sedr() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
