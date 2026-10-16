# Tiba Shadow — Version 191 Client Contract Inventory (Audit 1)

Date: 2026-10-16  
Branch: `shadow/phase1-hardening`  
Target: `bvyxiahpxogblkmtjxyx` (Tiba Shadow)  
Status: static source audit only; no target database writes.

## Purpose

Record the concrete Supabase RPC contracts observed in the client so the clean Shadow schema can be built around actual application calls rather than assuming that a list of tables or generated TypeScript definitions is sufficient. This is not a claim that the current branch is fully bootstrappable.

## Client calls observed

| Client surface | RPC / service call | Contract significance |
|---|---|---|
| Shared live data service | `get_phase1_snapshot()` | Common operational snapshot; depends on core tables and role/office scoping |
| Driver portal | `driver_get_portal_snapshot()` | Driver home data; must match current client naming (generated types also contain older `get_driver_portal_snapshot`) |
| Driver direct assignments | `driver_get_pending_assignments()` | Pending direct assignments; generated types/older migrations use `get_pending_direct_assignments` |
| Driver dispatch | `driver_get_dispatch_state()` | Requires queue tables, active window semantics, and driver scope |
| Driver queue selection | `driver_select_load(uuid)` | Requires queue tables, active driver-vehicle link, current GPS, and Ras Sedr geofence |
| Driver delivery | `driver_confirm_delivery(...)` | Must match current argument shape including GPS timestamp, accuracy, weight and optional scale image path; older historical migration overloads differ |
| Driver accepts direct assignment | `accept_direct_assignment(uuid)` | Requires explicit acceptance state and trip identity consistency |
| Office waiting list | `get_office_waiting_list()` | Depends on queue tables and office authority checks |
| Available vehicles | `get_available_vehicles()` | Depends on vehicle ownership and current driver/vehicle assignment model |
| Vehicle owner directory | `get_vehicle_owner_directory()` | Referenced by office directory UI; later hardening migrations assume it exists |
| Vehicle live locations | `get_vehicle_live_locations()` | Tracking read contract; preserve existing tracking behavior |
| Office creates vehicle | `create_operational_vehicle(text,text,text)` | Must be checked against owner/vehicle model and overload drift |
| Office creates load order | `create_load_order(...)` | Must be atomic, scoped to HEAD_OFFICE and consistent with dispatch window publication |
| Direct load assignment | `direct_assign_standalone_load(...) ` | Must be conflict-checked, auditable, and compatible with driver acceptance |
| Account statement | `get_account_statement_records(date,date)` | Reporting contract depends on actual loading records and current trip identity |
| Branch employee directory | `get_branch_employee_directory()` / `update_branch_employee_details(uuid,text,text)` | Read-only branch directory, distinct from operational write authority |
| Branch snapshot | `get_branch_office_snapshot()` | Branch-facing read model; must not grant branch operational write permission |

## Contract mismatches that must be resolved before migration generation

1. **Client function names diverge from generated types / older SQL.** The driver UI calls `driver_get_portal_snapshot` and `driver_get_pending_assignments`; the generated types include `get_driver_portal_snapshot` and `get_pending_direct_assignments`. Do not create aliases blindly: establish which client ref/build is the intended v191 baseline and make one explicit compatibility decision.
2. **Delivery confirmation signature drift.** Current client supplies booking ID, latitude, longitude, accuracy, captured timestamp, actual weight, image path, and notes. Historical migrations show older overloads with different parameters. The clean RPC must match the actual client invocation exactly.
3. **Queue layer is not self-contained.** The recovered historical queue migration creates `dispatch_windows`, `waiting_list_entries`, and `driver_load_choices`, and references core tables including `driver_vehicle_assignments`, `driver_live_locations`, `bookings`, `load_orders`, and `audit_log`. It cannot be applied before the core schema and compatible assignment relation exist.
4. **Tracking is a protected invariant.** The driver client uses native background tracking, live GPS, freshness checks, and delivery GPS. Do not modify tracking or AI-assistant behavior while building the Shadow schema.
5. **Reporting depends on operational truth.** Actual weight, ticket/scale image metadata, trip codes, delivery confirmation, and booking lifecycle must be represented consistently. Do not seed or import real operational rows during bootstrap.
6. **Office authority is server-side.** HEAD_OFFICE is the only operational write authority; Ras Sedr is the canonical geofence/check-in reference. UI hiding is not sufficient; RPCs must deny unauthorized writes.

## Safe implementation sequence

1. Pin the intended v191 source/build commit and inventory every Supabase RPC invocation and direct table/storage access from that exact source.
2. Build an RPC contract matrix with exact argument names/types, return shape, role gates, required tables, and source migration.
3. Recover or semantically reconcile missing historical migration sources; do not fabricate originals.
4. Create an ordered clean migration chain from an empty database. Keep optional scheduler/pg_cron setup separate from schema DDL and verify extension availability.
5. Run the complete chain against a disposable PostgreSQL instance, then authenticated role/RLS/RPC tests.
6. Only after that, apply to Tiba Shadow and point a test-only Android build at it. Keep production and the working v191 release untouched until explicit approval.

## Evidence boundary

This document is based on static GitHub client/SQL inspection. It does not prove a full clean bootstrap, target migration application, authenticated end-to-end operation, or Android device validation. No database was modified during this audit.
