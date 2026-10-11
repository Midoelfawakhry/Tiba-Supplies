-- Minimum database privileges required by the server-side account Edge Functions.
-- Keep these privileges scoped to account provisioning; do not grant broad table access.
GRANT SELECT, INSERT, DELETE ON TABLE public.app_users TO service_role;
GRANT SELECT, INSERT ON TABLE public.user_roles TO service_role;
GRANT SELECT ON TABLE public.roles TO service_role;
GRANT SELECT ON TABLE public.offices TO service_role;
GRANT SELECT ON TABLE public.drivers TO service_role;
GRANT UPDATE (auth_user_id) ON TABLE public.drivers TO service_role;

NOTIFY pgrst, 'reload schema';
