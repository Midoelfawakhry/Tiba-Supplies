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



## Additional canonical-schema blockers confirmed — 2026-10-17

Static comparison of the candidate baseline against the read-only Production schema and the historical operational migrations shows these are not cosmetic naming differences:

| Concern | Candidate baseline | Production / operational source | Required decision |
|---|---|---|---|
| Office identity | `office_code IN ('MAIN','RAS_SEDR')`; `office_type IN ('HEAD_OFFICE','BRANCH')`; unique office type | Production `office_type` enum uses `HEAD` / `BRANCH`; operational SQL selects `office_type='HEAD'` and `office_type='BRANCH'` | Choose canonical code/type values and update all seed, RPC, and UI assumptions together |
| App-user authorization | Single `app_users.role` text column, limited to `ADMIN` / `HEAD_OFFICE` | Production uses normalized `roles` + `user_roles` and active `app_users` profiles | Preserve normalized authorization model or explicitly justify a reviewed migration; do not maintain two role sources |
| Booking lifecycle | Text check with `ASSIGNED`, `ARRIVED`, `LOADING`, `LOADED`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED` | Production `load_status` enum includes `BOOKED`, `LOADING_STATEMENT`, `COMPLETED`, `REJECTED`, `NO_SHOW`, `FAILED`, `ON_HOLD`, and other states | Define one explicit state transition map before writing assignment, cancellation, or delivery RPCs |
| Actual loading | `booking_id NOT NULL UNIQUE`; booking-centric columns | Production allows `booking_id NULL` for standalone paper actual loading and stores `load_date`, vehicle/driver/factory/quarry IDs, trip code, daily load number, and sequence date | Keep actual paper loading and standalone direct loads representable; do not force every row into a booking |
| Driver/vehicle history | Baseline does not establish the historical relation consistently | Production uses `vehicle_driver_assignments(vehicle_id,driver_id,assigned_from,assigned_to)`; queue/native tracking sources reference `driver_vehicle_assignments` with `assigned_at/ended_at` semantics | Choose one canonical relation and translate all RPC/native tracking access in one reviewed change |
| Queue scheduler | Queue schema/RPC migration and scheduler are separate | Optional scheduler migration installs `pg_cron` and schedules a minute-level finalizer | Keep scheduler opt-in; run plain PostgreSQL bootstrap tests without `pg_cron`, then separately validate target support |

The current candidate baseline creates 14 tables and no v191 RPCs. It is a planning artifact, not a source-faithful Production clone. The queue migration is now present on the review branch, but its availability does not resolve the core-schema or assignment-model conflicts.


## CI evidence update — 2026-10-17

GitHub Actions run [Phase 1 Shadow CI #38974294393](https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38974294393) and [Phase 1 build #38974294299](https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38974294299) passed on commit `7e96394cb18a303258a29e9a7f79cfdb9611bd61`. The Shadow CI workflow successfully replayed its configured numeric-prefix v191 chain on disposable PostgreSQL 16 and asserted RPC names and queue/assignment objects. This is useful evidence, but not the final bootstrap gate: the standalone `supabase/tests/phase1_v191_contract_gate.sql` is not invoked by the inspected workflow, non-standard legacy filenames are excluded from the replay, and no authenticated live Shadow or Android device end-to-end test is established. Full details: [CI evidence report](TIBA-SHADOW-CI-EVIDENCE-2026-10-17.md).

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


## Confirmed contract blocker — delivery and paper actual-loading (2026-10-17)

Static comparison of the current v191 `DriverApp.tsx` with the clean-chain delivery migration confirmed that the client passes eight named arguments to `driver_confirm_delivery`, including actual weight and scale image path, while `20261014300000_phase1_harden_driver_delivery_confirmation.sql` defines only six arguments and does not persist or return actual weight. The standalone v191 contract gate is not currently run in the inspected CI workflow, so the green chain smoke does not catch this mismatch.

The clean baseline also requires `actual_loading_records.booking_id` and `recorded_by` to be non-null and ties each record uniquely to a booking; this does not model paper actual-loading entries independent of bookings as seen in the Production inventory. Resolution must cover storage, identity, atomicity, and idempotency—not merely add unused RPC parameters.

Detailed evidence and acceptance criteria: [Delivery and actual-loading gap report](TIBA-V191-CONTRACT-DELIVERY-AND-STANDALONE-LOAD-GAP-2026-10-17.md). Keep this a release blocker until the contract is reconciled and tested.
