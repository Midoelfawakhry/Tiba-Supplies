# Shadow Schema Inventory — 2026-10-14

## Scope
Read-only inventory of the currently connected production Supabase project. No data rows were selected and no changes were applied.

## Public tables
The connected project reports 32 public tables. All 32 have RLS enabled according to the table inventory, but a direct query of `pg_policies` returned **zero policies** in the public schema. This must be treated as a high-priority access-control review item: RLS enabled with no policies normally denies access to non-owner roles, but SECURITY DEFINER functions and explicit grants can still expose operations. Review RPC grants and function bodies before changing anything.

Tables observed:
- offices
- roles
- app_users
- user_roles
- vehicle_owners
- vehicles
- drivers
- vehicle_driver_assignments
- factories
- quarries
- quarry_factory_relations
- load_orders
- waiting_list_entries
- location_events
- bookings
- loading_statements
- actual_loading_records
- delivery_confirmations
- notifications
- audit_log
- historical_loading_staging
- vehicle_owner_import_staging
- driver_office_assignments
- driver_invitations
- dispatch_test_drivers
- driver_live_locations
- standalone_direct_load_audit
- Reversed
- vehicle_owner_import_staging_backup_20261010
- daily_loading_counters
- daily_trip_counters
- driver_location_tracking_sessions

## Important observations
1. Several staging/backup-like tables are present (`historical_loading_staging`, `vehicle_owner_import_staging`, `vehicle_owner_import_staging_backup_20261010`, and `Reversed`). Do not copy these to Shadow without confirming their purpose and whether they contain sensitive operational data.
2. The core domain includes offices, roles, app users, drivers, vehicle owners, vehicles, factories, quarries, driver/vehicle assignments, load orders, bookings, actual loading records, delivery confirmations, notifications, and location tracking.
3. The production project has active Edge Functions: `create-driver-account` (verify_jwt=false), `create-branch-employee` (verify_jwt=true), `tiba-ai-assistant` (verify_jwt=true), and `driver-native-location` (verify_jwt=false). The false flags are review findings, not proof of an exploit; inspect function-level authentication and authorization before deploying to Shadow.
4. Production migration ledger and repository migration filenames are not reconciled (see `SHADOW-MIGRATION-RECONCILIATION-2026-10-14.md`).

## Safe next steps
- Retrieve canonical schema-only definitions for tables, enums, constraints, indexes, triggers, views, functions, grants, and policies.
- Review SECURITY DEFINER functions and explicit EXECUTE grants as a separate security workstream.
- Identify and document the intended policies for each role (ADMIN, HEAD_OFFICE, BRANCH, driver) before writing any policy migration.
- Build a clean baseline for fresh environments only after exact schema/function definitions and migration ordering are reconciled.
- Use synthetic test accounts/data in Shadow. Do not copy production credentials or secrets.
- No production writes, DDL, or policy changes were performed for this inventory.
