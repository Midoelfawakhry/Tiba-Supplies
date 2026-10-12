-- Office-only, audited creation of factory/customer and quarry directory records.
CREATE OR REPLACE FUNCTION public.office_create_directory_entity(
  p_entity_type text,
  p_name text,
  p_code text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth uuid := auth.uid();
  v_actor uuid;
  v_name text := btrim(COALESCE(p_name, ''));
  v_code text := NULLIF(btrim(COALESCE(p_code, '')), '');
  v_id uuid;
  v_entity_label text;
BEGIN
  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT au.user_id INTO v_actor
  FROM public.app_users au
  JOIN public.user_roles ur ON ur.user_id = au.user_id
  JOIN public.roles r ON r.role_id = ur.role_id
  WHERE au.auth_user_id = v_auth
    AND au.is_active = true
    AND r.name IN ('ADMIN', 'HEAD_OFFICE')
  LIMIT 1;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_ROLE';
  END IF;

  IF v_name = '' THEN
    RAISE EXCEPTION 'DIRECTORY_NAME_REQUIRED';
  END IF;

  IF p_entity_type = 'FACTORY' THEN
    IF v_code IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.factories f WHERE lower(f.code) = lower(v_code)
    ) THEN
      RAISE EXCEPTION 'DIRECTORY_CODE_EXISTS';
    END IF;

    INSERT INTO public.factories (name, code, is_active)
    VALUES (v_name, v_code, true)
    RETURNING factory_id INTO v_id;

    v_entity_label := 'factory';
  ELSIF p_entity_type = 'QUARRY' THEN
    IF v_code IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.quarries q WHERE lower(q.code) = lower(v_code)
    ) THEN
      RAISE EXCEPTION 'DIRECTORY_CODE_EXISTS';
    END IF;

    INSERT INTO public.quarries (name, code, is_active)
    VALUES (v_name, v_code, true)
    RETURNING quarry_id INTO v_id;

    v_entity_label := 'quarry';
  ELSE
    RAISE EXCEPTION 'DIRECTORY_ENTITY_TYPE_INVALID';
  END IF;

  INSERT INTO public.audit_log (
    actor_user_id, action, entity_type, entity_id, old_data, new_data
  )
  VALUES (
    v_actor,
    CASE WHEN p_entity_type = 'FACTORY' THEN 'FACTORY_CREATED' ELSE 'QUARRY_CREATED' END,
    v_entity_label,
    v_id::text,
    NULL,
    jsonb_build_object('name', v_name, 'code', v_code, 'is_active', true)
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

REVOKE ALL ON FUNCTION public.office_create_directory_entity(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_create_directory_entity(text, text, text) TO authenticated;
