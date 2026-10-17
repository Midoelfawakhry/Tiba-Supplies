-- Restore the office notification relation required by main_office_get_dashboard.
-- Shadow only. Keep client table access revoked; notifications are read through scoped RPCs.
CREATE TABLE IF NOT EXISTS public.office_notifications (
  office_notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(office_id) ON DELETE RESTRICT,
  load_order_id uuid NULL REFERENCES public.load_orders(load_order_id) ON DELETE SET NULL,
  notification_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS office_notifications_office_created_idx
  ON public.office_notifications (office_id, created_at DESC);

ALTER TABLE public.office_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.office_notifications FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
