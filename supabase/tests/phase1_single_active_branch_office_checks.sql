-- CI-only regression test against a disposable PostgreSQL service.
-- NEVER run this fixture script against Supabase production.
\set ON_ERROR_STOP on

DROP TABLE IF EXISTS public.offices;
DROP TYPE IF EXISTS public.office_type;
CREATE TYPE public.office_type AS ENUM ('HEAD', 'BRANCH');
CREATE TABLE public.offices (
  office_id uuid PRIMARY KEY,
  office_type public.office_type NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

\i supabase/migrations/20261011133500_enforce_single_active_branch_office.sql

INSERT INTO public.offices (office_id, office_type, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'BRANCH', true);

DO $duplicate_active_branch$
BEGIN
  BEGIN
    INSERT INTO public.offices (office_id, office_type, is_active)
    VALUES ('00000000-0000-0000-0000-000000000002', 'BRANCH', true);
    RAISE EXCEPTION 'DUPLICATE_ACTIVE_BRANCH_WAS_ACCEPTED';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END
$duplicate_active_branch$;

-- Inactive historical branches are permitted, but not a second active branch.
INSERT INTO public.offices (office_id, office_type, is_active)
VALUES ('00000000-0000-0000-0000-000000000003', 'BRANCH', false);
INSERT INTO public.offices (office_id, office_type, is_active)
VALUES ('00000000-0000-0000-0000-000000000004', 'HEAD', true);

DROP TABLE public.offices;
DROP TYPE public.office_type;
