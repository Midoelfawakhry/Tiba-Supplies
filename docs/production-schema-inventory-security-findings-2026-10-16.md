# Production Schema Inventory and Security Findings — 2026-10-16

## Scope
Read-only review of production Supabase project `tnlcvwtphbunteifoonc`. No database writes or migrations were performed. Do not treat this inventory as a complete SQL bootstrap dump.

## Client type snapshot
Generated official Supabase TypeScript types from the live production project and committed them to `docs/generated/production-database.types.ts` on `shadow/phase1-hardening`.
- Generated type source length: 47485 characters.
- This describes exposed table/view rows, inserts, updates, relationships, RPC signatures, and enum types where exposed.
- It is not a replacement for database DDL, RLS policies, grants, triggers, extension configuration, or function bodies.

## Public schema inventory
- `offices`
- `roles`
- `app_users`
- `user_roles`
- `vehicle_owners`
- `vehicles`
- `drivers`
- `vehicle_driver_assignments`
- `factories`
- `quarries`
- `quarry_factory_relations`
- `load_orders`
- `waiting_list_entries`
- `location_events`
- `bookings`
- `loading_statements`
- `actual_loading_records`
- `delivery_confirmations`
- `notifications`
- `audit_log`
- `historical_loading_staging`
- `vehicle_owner_import_staging`
- `driver_office_assignments`
- `driver_invitations`
- `dispatch_test_drivers`
- `driver_live_locations`
- `standalone_direct_load_audit`
- `Reversed`
- `vehicle_owner_import_staging_backup_20261010`
- `daily_loading_counters`
- `daily_trip_counters`
- `driver_location_tracking_sessions`
- Table count returned by live table listing: 32.
- All returned public tables reported RLS enabled.
- Main operational entities include offices, drivers, vehicles, vehicle owners, factories, quarries, load orders, bookings, actual loading records, location tracking, waiting lists, notifications, and audit/staging records.

## Generated enum types
- `load_status`
- `location_event_type`
- `office_type`
- `waiting_status`

## Exposed RPC/type function names
- `accept_direct_assignment`
- `create_load_order`
- `direct_assign_standalone_load`
- `driver_arrive`
- `driver_confirm_delivery`
- `get_account_statement_records`
- `get_available_driver_vehicles`
- `get_direct_assignment_trip_identity`
- `get_driver_geofence_status`
- `get_vehicle_owner_reports`
- `office_cancel_booking`
- `office_create_directory_entity`
- `office_redirect_booking`
- `office_remove_waiting_entry`
- `record_driver_location`
- `save_master_directory_entry`
- `set_branch_employee_active`
- `set_operational_driver_active`
- `update_driver_live_location`
- `update_operational_driver`
- `update_operational_vehicle`

## Supabase Security Advisor — live result
### RLS Enabled No Policy (`rls_enabled_no_policy`): 32 finding(s), level INFO
- Table \`public.Reversed\` has RLS enabled, but no policies exist
- Table \`public.actual_loading_records\` has RLS enabled, but no policies exist
- Table \`public.app_users\` has RLS enabled, but no policies exist
- Table \`public.audit_log\` has RLS enabled, but no policies exist
- Table \`public.bookings\` has RLS enabled, but no policies exist

### Signed-In Users Can Execute SECURITY DEFINER Function (`authenticated_security_definer_function_executable`): 37 finding(s), level WARN
- Function `public.accept_direct_assignment(p_booking_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/accept_direct_assignment`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Function `public.assign_driver_vehicle(p_vehicle_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/assign_driver_vehicle`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Function `public.bind_driver_auth(p_invitation_token text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/bind_driver_auth`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Function `public.create_load_order(p_factory_id uuid, p_quarry_id uuid, p_requested_quantity integer, p_priority integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_load_order`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.
- Function `public.create_operational_driver(p_name text, p_phone text, p_plate_number text, p_driver_code text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_operational_driver`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.

### Leaked Password Protection Disabled (`auth_leaked_password_protection`): 1 finding(s), level WARN
- Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security.

**Critical interpretation:** Security Advisor reports `rls_enabled_no_policy` for 32 public tables. This matches the earlier empty result from direct `pg_policies` query, and is a material security/configuration concern to resolve before treating the clone as safe. Do not blindly add policies: the application may depend on carefully scoped SECURITY DEFINER RPCs, and access patterns must be reconstructed first. No policy changes were made.

## Supabase Performance Advisor — live result
- Unindexed foreign keys (`unindexed_foreign_keys`): 22 finding(s), level INFO
- No Primary Key (`no_primary_key`): 2 finding(s), level INFO
- Unused Index (`unused_index`): 4 finding(s), level INFO

## Migration history
The live project has 39 migration ledger entries visible through the connector. These entries do not prove a clean bootstrap exists: the repository audit already found that core CREATE TABLE definitions are missing from the current migration path.

## Extensions
The production project has 78 extension entries visible through the connector. Full extension details should be preserved from a schema-only database dump before bootstrap.

## Next safe actions
1. Acquire an authoritative schema-only SQL dump using a supported Supabase CLI/pg_dump workflow in an authorized environment.
2. Extract and review policies, grants, SECURITY DEFINER functions, function bodies, triggers, indexes, constraints, enum types, and extension setup.
3. Build a clean bootstrap migration on the isolated Shadow project only.
4. Validate RLS/access behavior with synthetic users for head office, branch office, driver, and vehicle owner.
5. Compare catalog object counts and run app smoke tests before any data migration. Production stays untouched.
