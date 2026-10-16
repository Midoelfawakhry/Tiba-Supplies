# Tiba-Supplies Shadow Compatibility Matrix — 2026-10-17

## Status and safety boundary

This is a source-derived review artifact for `shadow/phase1-hardening`, not an executable migration or approval to initialize a database.

- Production Supabase: `tnlcvwtphbunteifoonc` — read-only inspection only; no changes made.
- Intended Shadow Supabase: `bvyxiahpxogblkmtjxyx`.
- Review branch: `shadow/phase1-hardening`.
- Do not merge this branch to `main`; do not deploy AI Edge Function changes; do not change native driver tracking or the signed-release workflow as part of schema work.
- Do not apply migrations until a coherent clean bootstrap passes on disposable PostgreSQL and the complete contract gate passes.
- The production schema export is useful evidence of table/function/constraint/trigger definitions, but it contains no `CREATE POLICY`, `GRANT`, or `CREATE EVENT TRIGGER` statements; it is not a complete security/bootstrap dump.

## Live environment recheck

Read-only catalog inspection on 2026-10-17 found:

### Production

- 32 public tables returned by the live inventory; all inspected relations have RLS enabled.
- A direct `pg_policy` count returned **zero policies for each of those 32 tables**. This is also documented in the live Security Advisor inventory. Do not blindly create policies; first establish the intended access model, direct table grants, and RPC-only access patterns.
- Existing security-definer functions commonly grant EXECUTE to `authenticated`; each must be checked for server-side identity, role, office scope, booking ownership, and input validation.
- `accept_direct_assignment(uuid)` exists and is SECURITY DEFINER, with EXECUTE for `authenticated`.
- `driver_confirm_delivery(uuid,numeric,text,numeric,numeric)` exists in production. This five-argument signature does not satisfy the current v191 driver's eight named arguments.
- `get_driver_portal_snapshot()` and `get_pending_direct_assignments()` exist; the v191 client calls `driver_get_portal_snapshot()` and `driver_get_pending_assignments()`.
- `update_driver_live_location(..., p_captured_at timestamptz DEFAULT now())` exists. A default server timestamp cannot prove the device's real capture time when the client omits that argument; v191 should pass a fresh captured timestamp explicitly and the server must reject missing/stale/future timestamps.
- Production trigger inventory includes booking and actual-loading trip-code assignment triggers and driver-to-Ras-Sedr assignment triggers. Preserve and test these behaviors when building the isolated baseline.
- Production extensions observed: `pgcrypto`, `plpgsql`, `pg_stat_statements`, `supabase_vault`, `uuid-ossp`.

### Intended Shadow

- Application relations in schema `public`: **none**.
- Migration ledger: **one row**, `20261016210023 / phase1_revoke_public_rls_event_trigger_shadow_remediation`. Older planning documents that say the ledger is empty are stale and must not be used as the live state.
- Event trigger `ensure_rls` is enabled for `ddl_command_end`, using `public.rls_auto_enable()`; its ACL currently grants EXECUTE to `postgres` only.
- Do not reset the project or remove the existing migration. A future baseline must account for this existing ledger/event-trigger state explicitly.

## Compatibility matrix

| Area | Production / source evidence | Current clean baseline or v191 expectation | Disposition |
|---|---|---|---|
| Identity and permissions | Production uses `app_users`, `roles`, and `user_roles`; functions must authorize by authenticated identity and role. | Baseline puts a `role` text column on `app_users`, omitting the normalized role relation. | **Blocker:** choose the production-compatible model unless a documented v191 requirement justifies a deliberate change. |
| Office model | Production enum is `office_type = HEAD, BRANCH`; operational authority is Head Office, with Ras Sedr used for geofence/check-in. | Baseline uses `HEAD_OFFICE` / `BRANCH` and codes `MAIN` / `RAS_SEDR`. | **Blocker:** settle one canonical office enum/code contract; do not treat branch location as write authority. |
| Driver/vehicle assignment history | Production has `vehicle_driver_assignments(vehicle_id, driver_id, assigned_from, assigned_to)`, including a one-active-assignment constraint. Some newer queue code expects `driver_vehicle_assignments`. | Contract gate currently asserts `driver_vehicle_assignments` exists and `vehicle_driver_assignments` does not. | **Blocker:** inspect exact v191 source and every dependent RPC; select one canonical relation and adapt functions/tests. Never create both as competing sources of truth. |
| Load orders | Production uses `office_id`, `check_in_office_id`, and enum `load_status`; load creation is Head Office scoped. | Baseline uses different fields and a text status lifecycle. | **Blocker:** map field names and allowed states to actual client and operational RPC contracts. |
| Booking lifecycle | Production `bookings` has trip identity fields and enum statuses including `BOOKED`, `LOADING_STATEMENT`, `IN_TRANSIT`, `DELIVERED`, etc. Direct assignment acceptance is separate from final loading. | Baseline uses `ASSIGNED`, `ARRIVED`, `LOADING`, `LOADED`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`; it requires `load_order_id` and `assigned_by`. | **Blocker:** preserve the design that a direct assignment begins as `BOOKED` and actual loading is not created before driver acceptance. Support standalone direct loads where production requires them. |
| Actual loading | Production supports standalone actual loading: nullable `booking_id`, required `load_date`, vehicle/driver/quarry, trip code and daily/sequence fields; a trigger assigns trip identity. | Baseline requires a booking and omits operational columns. | **Blocker:** preserve paper-based actual loading independent of a booking while retaining optional booking linkage, uniqueness and trip-code rules. |
| Driver portal RPC names | Production exposes `get_driver_portal_snapshot()` and `get_pending_direct_assignments()`. | v191 calls `driver_get_portal_snapshot()` and `driver_get_pending_assignments()`; it also calls `driver_get_dispatch_state()`. | **Blocker:** implement reviewed compatibility RPCs or change client only through a deliberate versioned decision; don't silently assume names are aliases. |
| Delivery confirmation | Production signature: `driver_confirm_delivery(p_booking_id, p_actual_weight, p_scale_image_path, p_latitude, p_longitude)`. | v191 sends eight named args: `p_booking_id, p_latitude, p_longitude, p_accuracy_m, p_captured_at, p_actual_weight, p_scale_image_path, p_notes`; client checks `data.confirmed`. | **Blocker:** implement/test the exact eight-argument contract, ownership, accepted booking state, location accuracy/freshness, weight, image path, idempotency and result shape. |
| Direct assignment acceptance | Production `accept_direct_assignment(p_booking_id uuid)` exists; source history has an unresolved exact migration version. | v191 requires `accepted=true`, `acceptance_status='ACCEPTED'`, `accepted_at`, and displays `trip_code`. | **Blocker:** align returned JSON and error identifiers; test owner-only acceptance and concurrent duplicate calls. |
| GPS and geofence | Production has live location update and geofence functions; current client expects server-validated Ras Sedr radius, freshness and accuracy. | v191 expects error IDs including `OUTSIDE_RAS_SEDR_GEOFENCE`, `LOCATION_TIMESTAMP_STALE_OR_INVALID`, `LOCATION_ACCURACY_TOO_LOW`, `DRIVER_ACCEPTANCE_REQUIRED`, `BOOKING_NOT_AWAITING_ARRIVAL`. | **Blocker:** exact error contract, no trusted client-only geofence, and no substitute server time for device capture time. |
| Queue dispatch | Historical queue migration defines `dispatch_windows`, `waiting_list_entries`, `driver_load_choices`, transactional allocation, and optional pg_cron scheduling. It assumes a compatible core schema and has scheduler side effects. | Baseline omits the queue objects and required RPCs. | **Blocker:** reconcile queue table/status columns with production and v191, test transaction/locking/fairness, and keep pg_cron setup separate from schema DDL. |
| RLS and grants | Production RLS is enabled on 32 tables but live catalog reports zero policies. Security-definer RPCs have explicit grants and must enforce their own authorization. | Baseline enables RLS and revokes direct table grants; no complete policy/grant contract is supplied. | **Security blocker:** explicitly document intended RPC-only access and grants; test anon/authenticated behavior and every function's server-side authorization. Do not copy production's no-policy state without an explicit reviewed rationale. |
| Trip-code triggers | Production has triggers for bookings and actual-loading records. | Baseline has no equivalent trigger definitions. | **Blocker:** recover and test uniqueness/counter behavior, including concurrent inserts and standalone actual loads. |
| Historical migration sources | Three production ledger versions lack exact matching SQL in the known repository paths: `20261011004642_require_captured_driver_location_time`, `20261011020800_phase1_direct_assignment_acceptance_head_owned`, `20261011022028_enforce_head_office_write_permissions_fail_closed`. | Candidate files exist but are not proven to be exact historical blobs. | **Unresolved:** continue searching commits/tags/artifacts. If impossible, create clearly named archival reconstructions with provenance; never label them original or replay under historical version IDs. |
| AI assistant and native tracking | v191 AI behavior is user-confirmed working; native tracking and signed APK workflow are release-sensitive. | Not part of schema bootstrap. | **Out of scope:** preserve behavior; do not deploy Edge Functions or modify native tracking/build workflow in this schema task. |

## v191 RPC gate — required names and arguments

The current SQL contract gate expects these nine public RPCs:

1. `driver_get_pending_assignments()`
2. `driver_get_dispatch_state()`
3. `driver_get_portal_snapshot()`
4. `driver_select_load(p_load_order_id)`
5. `driver_confirm_delivery(p_booking_id, p_latitude, p_longitude, p_accuracy_m, p_captured_at, p_actual_weight, p_scale_image_path, p_notes)`
6. `accept_direct_assignment(p_booking_id)`
7. `driver_update_live_location(...)`
8. `driver_confirm_arrival(p_booking_id, p_latitude, p_longitude, p_accuracy_m, p_captured_at)`
9. `driver_check_in_queue(p_latitude, p_longitude, p_accuracy_m, p_captured_at)`

This is a presence/signature gate, not proof of behavior. Behavioral tests must cover unauthenticated calls, wrong driver, branch write denial, geofence boundaries, stale/inaccurate GPS, pending vs accepted assignments, duplicate delivery, concurrent selection/dispatch, and independent actual loading.

## Ordered next work

1. Pin source references and inspect the full production SQL export alongside `docs/generated/production-database.types.ts`, the current v191 client and all relevant SQL regression tests.
2. Finish the canonical-schema decision log for role/office model, assignment table, booking states, standalone loading, trip-code counters, and queue model.
3. Recover original base-schema and historical migration blobs where possible. For anything unrecoverable, mark the reconstruction separately and preserve evidence/provenance.
4. Build a **disposable local/CI PostgreSQL bootstrap** from the reviewed chain. Run the contract gate and behavioral regression suite; no production or Shadow SQL writes during this step.
5. Compare schema, constraints, indexes, triggers, function signatures/bodies, ACLs, RLS, and extension requirements against the reviewed contract.
6. Only after clean bootstrap and v191 behavioral gates pass, prepare a separately reviewed Shadow initialization migration plan. Preserve Shadow's existing migration ledger entry and event-trigger remediation.
7. Then, and only then, apply the reviewed plan to the intended Shadow project with a post-apply catalog comparison and authenticated RPC tests.

## Current gate decision

**SHADOW BOOTSTRAP: NOT READY.** There is no verified foundational migration chain, the current baseline conflicts with production and v191 on critical entities, several v191 RPCs are missing, and security behavior has not been reconstructed sufficiently. This document is a review artifact only; it does not authorize or perform any database mutation.
