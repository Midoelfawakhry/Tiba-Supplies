# Phase 1 Function Exposure Inventory (Read-only)

Date: 2026-10-14
Branch: shadow/phase1-hardening

## Scope and evidence
A read-only query of PostgreSQL function metadata in the production `public` schema inventoried SECURITY DEFINER functions, owners, signatures, and execute ACLs. This is a triage inventory, not a full code audit or proof of exploitability. No database objects or data were changed.

## High-priority review set
The following functions are SECURITY DEFINER and grant EXECUTE to `authenticated`; each should be reviewed for explicit identity, role, office scope, and input validation before Shadow testing:
- `get_phase1_snapshot()`
- `get_branch_office_snapshot()`
- `get_branch_employee_directory()`
- `get_office_waiting_list()`
- `get_vehicle_live_locations()`
- `get_vehicle_owner_directory()`
- `get_vehicle_owner_reports(date,date)`
- `get_account_statement_records(date,date)`
- `get_driver_edit_options(uuid)`
- `get_available_vehicles()`, `get_available_driver_vehicles()`
- `office_create_directory_entity(text,text,text)`
- `save_master_directory_entry(...)`
- `set_branch_employee_active(uuid,boolean)`
- `set_operational_driver_active(uuid,boolean)`
- `update_operational_driver(...)`, `update_operational_vehicle(...)`
- `office_redirect_booking(...)`, `office_cancel_booking(...)`, `office_remove_waiting_entry(...)`
- `dispatch_load(uuid)`, `direct_assign_standalone_load(...)`
- `driver_confirm_delivery(...)`, `driver_arrive(...)`, `record_driver_location(...)`, `update_driver_live_location(...)`
- `create_load_order(...)`, `create_operational_driver(...)` (two overloads), `create_operational_vehicle(...)` (two overloads)

The execute ACL for `get_driver_geofence_status(uuid)` is postgres-only, as are several trigger/helper functions. That is a positive least-privilege signal but does not by itself establish overall correctness.

## Specific concerns to verify
1. Office-scoped reads must derive the caller's active office from the authenticated identity and reject missing/ambiguous office mappings. A role check alone is insufficient for branch data.
2. Mutations must validate the caller's role and office scope inside the function, not rely solely on client-side UI.
3. SECURITY DEFINER functions should use a fixed safe search_path (the inventory showed `search_path=public` for sampled functions); review all referenced objects for schema qualification and consider excluding writable schemas.
4. Functions returning JSON or directory/report data should return only fields required by that caller.
5. Overloaded RPC signatures need independent review and explicit grants/revokes for each signature.
6. Verify default privileges and actual table grants alongside RLS; enabled RLS with zero visible policies is not enough to conclude exposure without checking owner/bypass paths, grants, and SECURITY DEFINER functions.

## Next safe step
Export full definitions and grants for the prioritized functions, compare each against its latest migration, then write isolated regression tests on Shadow after its schema is bootstrapped. Do not patch production and do not apply migrations until the migration ledger/file drift has been reconciled.

## Status
Read-only metadata inventory only. No production writes, no Shadow migrations, no test results claimed.
