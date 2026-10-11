-- Allow only ADMIN / HEAD_OFFICE to remove a driver from the active branch check-in queue.
-- This changes the queue state only; it does not delete driver, vehicle, or arrival history.

CREATE OR REPLACE FUNCTION public.office_remove_waiting_entry(
  p_entry_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auth uuid := auth.uid();
  v_actor uuid;
  v_branch_office_id uuid;
  v_entry public.waiting_list_entries%ROWTYPE;
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

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'REMOVE_REASON_REQUIRED';
  END IF;

  SELECT o.office_id INTO v_branch_office_id
  FROM public.offices o
  WHERE o.is_active = true
    AND o.office_type = 'BRANCH'
  ORDER BY o.name
  LIMIT 1;

  IF v_branch_office_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_BRANCH_OFFICE_NOT_CONFIGURED';
  END IF;

  SELECT * INTO v_entry
  FROM public.waiting_list_entries
  WHERE entry_id = p_entry_id
  FOR UPDATE;

  IF NOT FOUND OR v_entry.status <> 'WAITING' THEN
    RAISE EXCEPTION 'WAITING_ENTRY_NOT_FOUND';
  END IF;

  IF v_entry.office_id IS DISTINCT FROM v_branch_office_id THEN
    RAISE EXCEPTION 'WAITING_ENTRY_NOT_IN_BRANCH_QUEUE';
  END IF;

  UPDATE public.waiting_list_entries
  SET status = 'LEFT_QUEUE'
  WHERE entry_id = p_entry_id;

  INSERT INTO public.audit_log (
    actor_user_id, action, entity_type, entity_id, old_data, new_data
  )
  VALUES (
    v_actor,
    'WAITING_ENTRY_REMOVED_BY_HEAD_OFFICE',
    'waiting_list_entry',
    p_entry_id::text,
    jsonb_build_object(
      'status', v_entry.status,
      'driver_id', v_entry.driver_id,
      'vehicle_id', v_entry.vehicle_id,
      'office_id', v_entry.office_id,
      'arrived_at', v_entry.arrived_at
    ),
    jsonb_build_object(
      'status', 'LEFT_QUEUE',
      'reason', btrim(p_reason),
      'removed_by_user_id', v_actor,
      'removed_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', p_entry_id,
    'status', 'LEFT_QUEUE'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.office_remove_waiting_entry(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_remove_waiting_entry(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
