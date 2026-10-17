-- Allow the trusted create-driver-account Edge Function's service-role client
-- to read the selected driver fields and link auth_user_id. Client roles remain revoked.
GRANT SELECT, UPDATE ON TABLE public.drivers TO service_role;
