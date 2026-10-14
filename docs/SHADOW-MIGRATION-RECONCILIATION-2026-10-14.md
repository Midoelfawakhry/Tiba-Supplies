# Shadow Migration Reconciliation — 2026-10-14

## Scope and safety
Read-only comparison between `supabase/migrations/` on `shadow/phase1-hardening` and the migration ledger reported by the currently connected production Supabase project. No SQL was applied and no production state was changed.

## Result
- Repository migration files: **48**
- Production migration ledger entries: **39**
- The two histories are **not currently reproducible from each other**.
- Do not run the repository folder wholesale against a fresh project yet.

## Findings
1. **Repository files absent from the production ledger (by filename-derived version):** 26 candidates. Many filenames use date-only versions such as `20261010`, so multiple files share the same version prefix; these cannot safely serve as distinct ordered migration versions.
2. **Production ledger entries with no matching repository filename version:** 17 entries. They include versions such as `20261011004642`, `20261011020800`, `20261011210402`, `20261012151632`, and `20261014143544`.
3. **Version/name drift:** the production ledger version `20261012104135` is named `20261012120100_auto_assign_drivers_to_ras_sedr` in the ledger, while the repository file is `20261012104135_auto_assign_drivers_to_ras_sedr.sql`.
4. The file `20261009_phase1_live_core.sql` defines a snapshot function that references existing core tables (`app_users`, `user_roles`, `offices`, `factories`, `quarries`, `load_orders`, `bookings`, `actual_loading_records`, `drivers`, `vehicles`). It is not a complete base schema migration.
5. `supabase/archive/legacy-migrations/` contains a copy of `20261009_phase1_live_core.sql`; archived content must not be applied automatically.

## Required next steps
1. Preserve production as read-only.
2. Obtain the full canonical schema from the source of truth (schema-only dump or verified migration history), including tables, enums, constraints, indexes, triggers, functions, RLS policies, grants, storage buckets/policies, and required extensions.
3. Reconcile each production ledger entry to its exact SQL body; identify missing migrations and files whose names/versions were rewritten or duplicated.
4. Build a clean, ordered, uniquely versioned bootstrap history on the shadow branch. Do not rename old migrations that have already been applied in production; create a new canonical baseline strategy for fresh environments.
5. Apply only to an isolated Shadow project after cost approval, then verify a clean reset/build, authorization tests, and application build.
6. Seed only synthetic or anonymized operational data. Do not copy production user credentials or secrets; recreate Auth test users and Edge Function secrets separately.

## Decision
**Blocked from fresh-project migration execution until the history and base schema are reconciled.** This is a reproducibility issue, not proof that production is broken.
