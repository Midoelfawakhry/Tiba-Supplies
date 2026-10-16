# Tiba-Supplies v191 — Operational RPC Inventory (Source Recovery)

Date: 2026-10-16
Branch: `shadow/phase1-hardening`
Purpose: record source evidence and compatibility gaps before any executable clean-bootstrap migration is authored.

## RPCs with historical source located
| RPC | Historical source | Compatibility status |
|---|---|---|
| `get_phase1_snapshot()` | `20261009_phase1_live_core.sql` | Found, but source assumes core tables already exist; not a bootstrap by itself. |
| `create_load_order(uuid,uuid,integer,integer)` | `20261010_create_load_order_rpc.sql` | Found; must be reconciled to clean baseline columns, HEAD-only authority, and current UI args. |
| `get_available_vehicles()` | `20261010_create_operational_driver.sql`, later owner-enrichment migration | Found; historical source depends on `user_roles`, `roles`, and `vehicle_driver_assignments`, which clean baseline does not create. |
| `get_vehicle_owner_directory()` | `20261010182259_office_edit_driver_vehicle.sql` | Found; still requires full body/dependency review against baseline. |
| `get_account_statement_records(date,date)` | `20261011105953_account_statement_records_head_only.sql` and later weight-only revision | Found; actual-loading/trip lifecycle drift must be reconciled. |
| `update_branch_employee_details(uuid,text,text)` | `20261011170000_office_directory_edit_employee_deactivate_driver.sql` | Found; branch employee role/profile schema differs from baseline and must remain read-only operationally. |
| `get_driver_portal_snapshot()` | `20261011012500_direct_assignment_driver_snapshot.sql` | Historical name differs from v191's `driver_get_portal_snapshot()`; do not blindly alias. |
| `get_pending_direct_assignments()` | `20261011012000_direct_assignment_acceptance.sql` | Historical name and response shape differ from v191's `driver_get_pending_assignments()`. |
| `driver_get_dispatch_state()`, `driver_select_load(uuid)`, `driver_check_in_queue(...)` | `20261015180000_phase1_queue_selection_and_atomic_dispatch.sql` | Found historically; queue migration depends on missing assignment model, lifecycle columns/statuses, and office/audit helpers. |
| `get_office_waiting_list()` | queue migration and older tracking migration | Multiple implementations with different data shape and dependencies; choose one contract deliberately. |
| `accept_direct_assignment(uuid)` | `20261011012000_direct_assignment_acceptance.sql` | Found historically, but historical return fields/status vocabulary differ from v191 client expectations. |
| `direct_assign_standalone_load(uuid,uuid,uuid)` | `20261011012000_direct_assignment_acceptance.sql` | Found historically; status vocabulary and actual-loading columns conflict with clean baseline. |
| `get_vehicle_live_locations()` | `20261010_vehicle_live_tracking.sql` | Found historically; old source expects `vehicle_id`, `heading`, `speed_kmh`, `updated_at` on live-location rows, while clean baseline differs. |

## v191 RPCs still unresolved in inspected source
- `driver_get_portal_snapshot()`
- `driver_get_pending_assignments()`
- `driver_confirm_arrival(uuid, ...)`
- `driver_confirm_delivery(...)` with the eight named parameters used by the current client

A historical five-argument `driver_confirm_delivery` is not compatible with the current client invocation. No replacement function should be authored until behavior and transaction semantics are specified against the v191 caller.

## Cross-cutting blockers
1. Historical role model uses `roles` and `user_roles`; clean baseline uses `app_users.role`. A single authoritative role model must be selected.
2. Historical booking statuses and actual-loading columns differ from the clean baseline.
3. Historical live-location columns differ from the clean baseline.
4. The assignment relation has two competing names and two competing timestamp vocabularies.
5. Queue functions call helper functions whose authoritative definitions are not yet recovered.
6. The historical queue migration includes scheduler setup that must be separated and validated independently.

## Required next validation
- Pin the exact source commit corresponding to the tested/signed Android v191 build; version number alone is not a source SHA.
- Build a machine-checkable contract manifest from that source: RPC name, named args and SQL types, JSON response keys, error codes, required tables/columns, auth/role checks, and side effects.
- Reconcile historical source to one clean schema; do not mix incompatible migration generations.
- Run clean-install SQL, schema catalog assertions, RLS/role tests, concurrency tests, and isolated authenticated client smoke tests.
- Only then consider initializing Shadow. No production writes are authorized by this document.

## Safety status
This is a source-recovery inventory, not executable SQL. No database migration was applied by this audit.
