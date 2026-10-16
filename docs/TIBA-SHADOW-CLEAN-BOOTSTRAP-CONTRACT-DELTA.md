# Clean Bootstrap Contract Delta — 2026-10-16

## Scope

Compared the current branch's `20261014190000_phase1_clean_baseline.sql` with the repository's generated Supabase types at `supabase/analytics/database.types.ts`. This is a static source comparison only; generated types can be stale and are not proof of the live database contract.

## Baseline tables created

The clean baseline creates 14 tables:
`offices`, `app_users`, `factories`, `quarries`, `vehicle_owners`, `vehicles`, `drivers`, `load_orders`, `bookings`, `actual_loading_records`, `delivery_confirmations`, `driver_live_locations`, `notifications`, and `audit_log`.

## Additional table names present in generated types but not created by this baseline

Static extraction identified these table-like entries in generated types that are not created by the clean baseline:

- `daily_loading_counters`
- `daily_trip_counters`
- `dispatch_test_drivers`
- `driver_invitations`
- `driver_office_assignments`
- `historical_loading_staging`
- `loading_statements`
- `location_events`
- `quarry_factory_relations`
- `roles`
- `standalone_direct_load_audit`
- `user_roles`
- `vehicle_driver_assignments`
- `vehicle_owner_import_staging`
- `waiting_list_entries`

Some may be legacy, test-only, or superseded names; do not create all of them automatically. In particular, the active Phase 1 source uses `driver_vehicle_assignments` while generated types also include `vehicle_driver_assignments`; the contract must be resolved against the actual Version 191 code and chosen Phase 1 functions before writing DDL.

## Consequence

The baseline cannot yet be described as a complete bootstrap for the full existing application contract. It covers the core operational model, but additional objects used by the app and later migrations must be classified as:
1. required for Version 191,
2. required for selected Phase 1 workflows,
3. legacy/superseded,
4. test-only,
5. deliberately excluded from the new clean system.

## Next gate

Build a reviewed contract manifest with each object's source file, consuming RPC/UI call sites, required columns/signatures, authorization model, and migration order. Only objects classified as required should enter the clean bootstrap. Then run a disposable clean-install test and compare the resulting catalog against the manifest.

## Safety

No database writes or migrations were performed. This is not a ready-to-apply SQL script and does not authorize deployment.
