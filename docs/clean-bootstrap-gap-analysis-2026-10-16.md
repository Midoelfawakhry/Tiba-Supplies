# Clean Bootstrap Gap Analysis — 2026-10-16

## Purpose and safety
This document records source-level findings from the current repository and its migration
reconciliation notes. No migrations were run, no database was modified, and production
remains untouched. This is not a validated bootstrap plan.

## Confirmed facts
1. The migration named `20261009_phase1_live_core.sql` only defines
   `public.get_phase1_snapshot()`; it references existing tables and does not create the
   foundational application schema.
2. `20261010_create_load_order_rpc.sql` defines a function against existing tables
   including `app_users`, `user_roles`, `roles`, `factories`, `quarries`,
   `offices`, and `load_orders`.
3. `20261010_separate_operational_and_checkin_offices.sql` alters and updates
   `offices` and `load_orders`, and replaces snapshot, dispatch, and delivery functions.
   It assumes these relations and many operational tables already exist.
4. `docs/migrations/LEGACY_MIGRATION_RECONCILIATION.md` explicitly lists 11 legacy
   migration filenames without standard 14-digit prefixes and warns not to move them
   until a clean-database bootstrap path is validated.
5. The authoritative CREATE TABLE source for the core tables
   (`app_users`, `user_roles`, `roles`, `offices`, `factories`, `quarries`,
   `load_orders`, `bookings`, `actual_loading_records`, `drivers`, `vehicles`)
   has not been identified in the current active migration list. Test files contain
   partial fixture schemas, but they are not a production bootstrap source.
6. The three production migration versions recorded without exact matching SQL source
   remain unresolved in the reconciliation document:
   - `20261011004642_require_captured_driver_location_time`
   - `20261011020800_phase1_direct_assignment_acceptance_head_owned`
   - `20261011022028_enforce_head_office_write_permissions_fail_closed`

## Consequence
A blank database cannot safely be initialized by simply applying the current numbered
migration files in order: several required functions and ALTER statements depend on
tables whose authoritative creation scripts have not been found. The current migration
set is therefore not yet proven to be a reproducible, clean bootstrap.

## Safe recovery plan
1. Search every reachable branch, tag, and historical commit for the original core schema
   and the three missing migration sources; preserve exact blobs and commit provenance.
2. If original sources cannot be recovered, create a separately named, explicitly
   reconstructed baseline only after comparing its definitions against a read-only
   production catalog and the generated types. Never label a reconstruction as original.
3. Build a disposable PostgreSQL/Supabase environment and apply the candidate migration
   set from empty state in deterministic order.
4. Run all existing SQL regression tests and add acceptance cases for auth/roles,
   HEAD-versus-BRANCH separation, dispatch, direct-assignment acceptance, actual loading,
   captured GPS time/accuracy, duplicate delivery, and vehicle reassignment.
5. Compare resulting tables, constraints, indexes, triggers, function signatures/bodies,
   grants, RLS, and Edge Function dependencies with the intended Shadow contract.
6. Only after review, document a migration manifest and request explicit approval before
   any change to production.

## Status
- Source inventory and dependency review: in progress.
- Clean bootstrap: not executed.
- Shadow schema/data changes: none.
- Production changes: none.
- Release approval: not granted.
