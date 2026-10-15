-- Fix missing branch employee directory RPC and profile fields used by the office UI.
-- Repair the branch employee directory RPC used by BranchEmployeeManagementScreen.
-- Keep username/phone on the app profile so the management UI can list and edit them.
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS phone text;

CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_lower_uidx
  ON public.app_users (lower(username))
  WHERE username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_branch_employee_directory()
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  phone text,
  is_active boolean,
  created_at timestamptz,
  office_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := public.current_main_office_user();

  RETURN QUERY
  SELECT
    au.user_id,
    au.username,
    au.display_name,
    au.phone,
    au.is_active,
    au.created_at,
    o.name AS office_name
  FROM public.app_users au
  JOIN public.offices o ON o.office_id = au.office_id
  WHERE o.office_code = 'RAS_SEDR'
    AND o.office_type = 'BRANCH'
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.role_id = ur.role_id
      WHERE ur.user_id = au.user_id
        AND r.name = 'BRANCH'
    )
  ORDER BY au.is_active DESC, au.created_at DESC, au.display_name;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_branch_employee_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_branch_employee_directory() TO authenticated;
