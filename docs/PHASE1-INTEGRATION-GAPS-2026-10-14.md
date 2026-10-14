# Phase 1 Frontend Integration Gaps

Date: 2026-10-14
Branch: `shadow/phase1-hardening`

## Confirmed changes in this batch
- `LiveOperationsBoard.tsx` now creates a DRAFT order with `main_office_create_load_order` and publishes it with `main_office_publish_load_order`.
- Shadow migration `20261014270000_phase1_driver_audit_and_delivery_gate.sql` fixes driver-arrival audit ownership, adds driver-owned delivery confirmation, and requires that confirmation before Main Office can set a booking to DELIVERED.
- Read-only catalog query confirmed the relevant Main Office and driver RPCs exist with `SECURITY DEFINER` and authenticated execution grants.

## Remaining integration blockers
1. `DirectLoadAssignmentScreen.tsx` was updated to use `main_office_direct_assign(load_order_id, driver_id, vehicle_id)` and select a published order, active driver, and active vehicle. Server-side checks remain authoritative. UI build/runtime validation is still pending.
2. `DriverApp.tsx` now calls `driver_get_portal_snapshot`, `driver_get_pending_assignments`, `driver_update_live_location`, and `driver_confirm_arrival`. The portal only exposes published loads when the driver's GPS is fresh (10 minutes), accurate (<=100m on location write), and within the Ras Sedr 10km geofence. Direct assignment is active immediately in Phase 1; the legacy second-step acceptance RPC is no longer called. Driver delivery confirmation UI is still not wired to `driver_confirm_delivery`.
3. `BranchOfficeApp.tsx` now calls `branch_get_snapshot`. The new Shadow migration adds the `BRANCH` app-user role and a read-only branch snapshot scoped to active Ras Sedr office identities. It returns published/in-progress orders, allocations, actual loading records, and active driver directory; waiting-list data is intentionally empty because Phase 1 has no queue table.
4. The driver portal adapts Phase 1 booking statuses to legacy display labels while also returning `raw_status` for server-state-aware actions. Other existing screens may still expect old status values and require review.
5. Delivery confirmation RPC currently stores driver-supplied coordinates but has no freshness/accuracy inputs and no destination coordinates to validate arrival at the receiving factory. Before production, add trusted location freshness/accuracy validation and factory delivery geofence if destination coordinates are required by operations.
6. No authenticated test identities or operational fixtures exist; do not create fake operational data in the shared Shadow database just to make the UI appear populated. Use isolated automated tests or a disposable test project.
7. No build/lint/E2E run has been completed as part of this integration batch. No branch-user identity or driver identity exists yet, so authenticated portal flows cannot be end-to-end exercised without provisioning controlled test identities.

## Safety boundary
Only Shadow project `awgppfjxegognuqozldl` is in scope. Production project `tnlcvwtphbunteifoonc` remains read-only.