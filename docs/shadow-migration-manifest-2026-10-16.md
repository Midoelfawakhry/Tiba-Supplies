# Shadow Migration Manifest — 2026-10-16

## Decision

**Do not initialize Tiba Shadow by replaying the current migration directory in filename order yet.** This is a reviewed planning manifest, not an executable migration script. No database changes are authorized or performed by this document.

## Verified environment

- Target: Supabase project `bvyxiahpxogblkmtjxyx` (Tiba Shadow, eu-west-1).
- Status: `ACTIVE_HEALTHY`.
- `public` application tables: none found.
- Supabase migration ledger: empty.
- Edge Functions listed in this project: none.

## Critical bootstrap finding

The legacy file `20261009_phase1_live_core.sql` is **not** a foundational schema migration. Its body defines `get_phase1_snapshot()` and references existing tables including `app_users`, `user_roles`, `roles`, `offices`, `factories`, `quarries`, `load_orders`, `bookings`, `actual_loading_records`, `drivers`, and `vehicles`. It does not create those tables.

Other legacy files similarly alter or reference existing objects (for example, `20261010_create_operational_driver.sql` adds columns to `drivers`, and `20261010_create_operational_vehicle.sql` adds columns to `vehicles`). The currently documented legacy migration list therefore does not establish the original base schema by itself. The source of the base schema must be found in repository history, another tracked artifact, or a verified schema-only export before a clean bootstrap can be designed.

## Candidate migration groups (not yet an execution order)

### A. Foundational schema — unresolved blocker

Required base objects include the identity/role model, offices, factories, quarries, drivers, vehicle owners, vehicles, driver/vehicle assignments, load orders, bookings, actual-loading records, and supporting audit/queue structures. The original create-table source and constraints have not yet been established from the known migration files. **Do not synthesize these tables from frontend types or later ALTER statements.**

### B. Legacy operational RPCs and schema changes

These filenames are recorded in `docs/migrations/LEGACY_MIGRATION_RECONCILIATION.md`; they need dependency review and cannot safely precede a verified base schema:

- `20261009_phase1_live_core.sql`
- `20261010_add_owner_name_to_available_vehicles.sql`
- `20261010_create_load_order_rpc.sql`
- `20261010_create_operational_driver.sql`
- `20261010_create_operational_vehicle.sql`
- `20261010_direct_load_assignment.sql`
- `20261010_driver_portal_geofence.sql`
- `20261010_separate_operational_and_checkin_offices.sql`
- `20261010_standalone_direct_assignment.sql`
- `20261010_vehicle_live_tracking.sql`
- `20261010zz_repair_vehicle_tracking_rpc_schema_cache.sql`

The tracking repair file is nearly identical to the tracking migration and additionally requests a PostgREST schema-cache reload. Exclude it from any replay plan unless a clean-bootstrap test demonstrates it is required.

### C. Versioned historical and incremental migrations

The reconciliation document records these aligned migration families and versions:

- `20261010182259_office_edit_driver_vehicle.sql`
- `20261011001729_vehicle_owner_reports.sql`
- `20261011001852_office_cancel_redirect_booking.sql`
- `20261011001910_prevent_cancel_loaded_trip.sql`
- `20261011002050_booking_destination_history.sql`
- `20261011002215_simplify_redirect_storage.sql`
- `20261011002708_phase1_cancel_queue_duplicate_guard.sql`
- `20261011003338_prevent_duplicate_delivery_confirmation.sql`
- `20261011003819_driver_geofence_status_helper.sql`
- `20261011004304_validate_captured_driver_location_time.sql`
- `20261011105953_account_statement_records_head_only.sql`
- `20261011125635_20261011150000_rebuild_head_owned_cancellation.sql`
- `20261011125637_20261011151000_dispatch_from_head_queue.sql`
- `20261011125640_20261011152000_cancel_in_transit_redirect_delivered.sql`
- `20261011125643_20261011153000_head_owned_booking_redirect.sql`
- `20261011125645_20261011160000_branch_office_accounts_readonly_app.sql`
- `20261011125650_20261011180000_weight_only_trip_codes.sql`
- `20261011125652_20261011190000_direct_assignment_trip_identity.sql`
- `20261011125655_20261011193000_direct_assignment_identity_lookup.sql`
- Candidate hardening: `20261012160000_head_office_master_directory_write.sql`, `20261012170000_harden_available_driver_vehicles.sql`, `20261012180000_enable_counter_rls.sql`
- Native tracking: `20261014_native_driver_tracking_sessions.sql`

Additional versioned files documented as not matching the exact production ledger versions include `20261011012000`, `20261011012500`, `20261011013000`, `20261011014000`, `20261011133300`, `20261011133500`, `20261011170000`, and `20261012120000`. Their current branch paths and content must be reconciled before inclusion in a baseline.

## Historical source gaps — not recovered yet

The production migration history is documented as containing these versions without exact same-version SQL source in the repository:

- `20261011004642_require_captured_driver_location_time`
- `20261011020800_phase1_direct_assignment_acceptance_head_owned`
- `20261011022028_enforce_head_office_write_permissions_fail_closed`

The expected file paths were checked on `main`, `backup-main-before-live-core`, `phase1-live-core`, `phase1-core-workflow`, `shadow/phase1-hardening`, and `chore/reconcile-legacy-migrations`; they were not present at those exact paths. This is not proof that no equivalent source exists anywhere in Git history. Search commits, tags, alternate paths, and deployment artifacts before deciding whether a clearly labeled archival reconstruction is needed. Never present a reconstruction as the original applied SQL.

## Required validation sequence

1. Recover the base schema source from repository history or a verified schema-only export.
2. Build a complete inventory of every SQL file on `shadow/phase1-hardening`; check duplicate version prefixes and untracked/legacy files.
3. For every migration, record prerequisite tables/functions, objects created/altered/dropped, role/grant effects, and whether it is historical, incremental, or candidate-only.
4. Resolve the three missing historical source gaps and all version-to-ledger mismatches. Preserve historical files; do not delete migration-history rows or replay candidate fixes under historical identifiers.
5. Construct a disposable PostgreSQL/Supabase bootstrap in a temporary environment and apply the reviewed manifest from zero. Run every existing SQL regression script, then add end-to-end tests for role gates, direct-assignment acceptance, concurrency/idempotency, geofence freshness, cancellation, redirect, delivery, and branch isolation.
6. Compare the resulting schema, grants, functions, triggers, and RLS settings against the reviewed expected state.
7. Only after the disposable bootstrap passes, apply the same reviewed set to the dedicated Tiba Shadow project and verify its migration ledger and authenticated RPC behavior.
8. Run app lint/build/contract tests and Android device smoke tests separately. Production and `main` remain untouched until release approval.

## Current status

- Repository source audit: **in progress**.
- Base schema source: **not yet identified**.
- Historical SQL source gaps: **not yet resolved**.
- Clean bootstrap: **not run**.
- Tiba Shadow application schema: **still empty**.
- Production mutations / merge to main: **none**.
