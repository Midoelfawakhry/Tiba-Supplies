-- Defense in depth for sequence counters used only by SECURITY DEFINER triggers.
-- Direct client privileges remain revoked; no client-facing policies are added.
-- The trigger functions are owned by the table owner and run as SECURITY DEFINER,
-- so normal counter allocation can continue without exposing the tables to clients.
ALTER TABLE public.daily_loading_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_trip_counters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.daily_loading_counters FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.daily_trip_counters FROM PUBLIC, anon, authenticated;
