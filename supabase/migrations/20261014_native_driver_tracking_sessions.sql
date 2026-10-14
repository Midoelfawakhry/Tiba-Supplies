-- Scoped native background tracking sessions. Tokens are random, short-lived, and stored only as SHA-256 hashes.
CREATE TABLE IF NOT EXISTS public.driver_location_tracking_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(driver_id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_driver_location_tracking_sessions_active
  ON public.driver_location_tracking_sessions(driver_id, expires_at)
  WHERE revoked_at IS NULL;
ALTER TABLE public.driver_location_tracking_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driver_location_tracking_sessions FROM PUBLIC, anon, authenticated;
