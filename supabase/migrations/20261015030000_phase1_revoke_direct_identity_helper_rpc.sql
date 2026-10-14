-- Keep identity resolver helpers internal to trusted SECURITY DEFINER RPCs.
REVOKE EXECUTE ON FUNCTION public.current_main_office_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_ras_sedr_branch_user() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
