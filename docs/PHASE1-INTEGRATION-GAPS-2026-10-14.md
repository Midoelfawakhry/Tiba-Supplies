# Phase 1 Frontend Integration Gaps

Date: 2026-10-14
Branch: `shadow/phase1-hardening`

## Confirmed changes in this batch
- `LiveOperationsBoard.tsx` now creates a DRAFT order with `main_office_create_load_order` and publishes it with `main_office_publish_load_order`.
- Shadow migration `20261014270000_phase1_driver_audit_and_delivery_gate.sql` fixes driver-arrival audit ownership, adds driver-owned delivery confirmation, and requires that confirmation before Main Office can set a booking to DELIVERED.
- Read-only catalog query confirmed the relevant Main Office and driver RPCs exist with `SECURITY DEFINER` and authenticated execution grants.

## Remaining integration blockers
1. `DirectLoadAssignmentScreen.tsx` was updated to use `main_office_direct_assign(load_order_id, driver_id, vehicle_id)` and select a published order, active driver, and active vehicle. Server-side checks remain authoritative. UI build/runtime validation is still pending.
2. `DriverApp.tsx` still relies on legacy `get_driver_portal_snapshot`, `get_pending_direct_assignments`, and `accept_direct_assignment`. It does not yet call Phase 1 RPCs for portal state/location/arrival/delivery.
3. `BranchOfficeApp.tsx` still calls legacy `get_branch_office_snapshot`. Replace with a read-only, scoped branch RPC before exposing it to branch users.
4. Some existing screens expect old status values (`BOOKED`, `LOADING_STATEMENT`) while Phase 1 uses `ASSIGNED`, `ARRIVED`, `LOADING`, `LOADED`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`.
5. Delivery confirmation RPC currently stores driver-supplied coordinates but has no freshness/accuracy inputs and no destination coordinates to validate arrival at the receiving factory. Before production, add trusted location freshness/accuracy validation and factory delivery geofence if destination coordinates are required by operations.
6. No authenticated test identities or operational fixtures exist; do not create fake operational data in the shared Shadow database just to make the UI appear populated. Use isolated automated tests or a disposable test project.
7. No build/lint/E2E run has been completed as part of this integration batch.

## Safety boundary
Only Shadow project `awgppfjxegognuqozldl` is in scope. Production project `tnlcvwtphbunteifoonc` remains read-only.