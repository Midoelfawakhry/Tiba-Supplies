# Tiba Shadow — v191 Bootstrap Gate: RPC and Schema Delta

Date: 2026-10-17
Branch: `shadow/phase1-hardening`
Target: Shadow project `bvyxiahpxogblkmtjxyx`
Scope: static comparison of current driver client calls with the clean baseline migration. No application schema migration was applied in this step.

## Evidence reviewed

- `src/components/DriverApp.tsx` on `shadow/phase1-hardening`
- `supabase/migrations/20261014190000_phase1_clean_baseline.sql`
- Existing historical migrations and the previously recorded v191 client contract inventory.

## Gate result: NOT READY for application bootstrap

The clean baseline creates 14 core tables but defines no public RPC functions. The current driver client invokes these nine RPC names:

1. `driver_get_pending_assignments()`
2. `driver_get_dispatch_state()`
3. `driver_get_portal_snapshot()`
4. `driver_select_load(p_load_order_id)`
5. `driver_confirm_delivery(p_booking_id, p_latitude, p_longitude, p_accuracy_m, p_captured_at, p_actual_weight, p_scale_image_path, p_notes)`
6. `accept_direct_assignment(p_booking_id)`
7. `driver_update_live_location(...)`
8. `driver_confirm_arrival(p_booking_id, p_latitude, p_longitude, p_accuracy_m, p_captured_at)`
9. `driver_check_in_queue(p_latitude, p_longitude, p_accuracy_m, p_captured_at)`

None of those names is implemented by the clean baseline migration. The baseline alone therefore cannot serve the current driver application.

## Known schema/lifecycle conflicts to resolve before writing RPCs

- Baseline `bookings.status` check allows `ASSIGNED`, `ARRIVED`, `LOADING`, `LOADED`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`. Historical assignment sources use `BOOKED` and `LOADING_STATEMENT`; do not introduce these states without a deliberate lifecycle mapping.
- Baseline `actual_loading_records` is booking-centric and does not include the historical direct-assignment columns `load_date`, `vehicle_id`, `driver_id`, `quarry_id`, `factory_id`. Reconcile the actual loading model before importing old insert logic.
- Current client calls `driver_get_portal_snapshot()`, while historical SQL contains `get_driver_portal_snapshot()`. Current client calls `driver_get_pending_assignments()`, while historical SQL contains `get_pending_direct_assignments()`. Do not silently rename client calls or assume aliases are behaviorally equivalent.
- Historical live tracking and assignment migrations use `vehicle_driver_assignments`; other queue/native tracking sources use `driver_vehicle_assignments`. Choose one canonical relation only after reviewing active-driver/vehicle semantics.
- Branch (`RAS_SEDR`) is a geofence/reference location, not an operational write authority. Main Office remains the write authority. Enforce this server-side in RPCs.
- Location-sensitive RPCs must validate capture time, accuracy, and geofence server-side. The client expects specific error identifiers, including `OUTSIDE_RAS_SEDR_GEOFENCE`, `LOCATION_TIMESTAMP_STALE_OR_INVALID`, `LOCATION_ACCURACY_TOO_LOW`, `DRIVER_ACCEPTANCE_REQUIRED`, and `BOOKING_NOT_AWAITING_ARRIVAL`.

## Required implementation sequence

1. Freeze the v191 RPC names and exact argument/result contracts from the client and tests.
2. Choose and document the canonical driver-vehicle assignment relation and booking lifecycle.
3. Reconcile the baseline table shape for direct assignments and actual loading records.
4. Implement the RPC layer with explicit `SECURITY DEFINER` search paths, auth/role/office scope checks, RLS-compatible access, concurrency protection, and idempotency.
5. Add SQL contract tests for grants, expected signatures, return payloads, status transitions, geofence/time checks, and office scope.
6. Apply the reviewed clean bootstrap to Shadow only; then run the SQL gate and authenticated runtime tests before generating a Shadow APK.

## Guardrails

- No schema migrations were applied as part of this audit.
- No changes to the operational Supabase project, signed release workflow, AI assistant, or native tracking code.
- The prior RLS event-trigger permission remediation is applied and verified on Shadow, but it does not make the application schema ready.
