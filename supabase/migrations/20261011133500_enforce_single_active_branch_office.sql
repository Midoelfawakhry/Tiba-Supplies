-- Ras Sedr is the single Phase 1 geofence/check-in reference.
-- Keep the invariant enforced by the database, not only by ORDER BY/LIMIT in RPCs.
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_branch_office
  ON public.offices (office_type)
  WHERE office_type = 'BRANCH'::public.office_type
    AND is_active IS TRUE;
