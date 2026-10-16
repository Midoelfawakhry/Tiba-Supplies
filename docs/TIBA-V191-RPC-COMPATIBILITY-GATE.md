# Tiba-Supplies v191 — RPC Compatibility Gate

Date: 2026-10-16
Branch: `shadow/phase1-hardening`
Scope: source-only compatibility gate. Preserve the v191 Android/client behavior; no database writes.

## Non-negotiable baseline
- Do not edit the v191 driver UI behavior, AI assistant, native background location service, tracking payloads, or signed release workflow as part of schema reconciliation.
- Do not apply migrations to Production.
- Do not initialize the Shadow database until the complete migration chain has passed clean-install and authorization tests.

## Confirmed client RPC contracts from current DriverApp.tsx
- `driver_get_portal_snapshot()`: response must include `driver_id`; client signs out if missing or errored.
- `driver_get_pending_assignments()`: client expects an array; historical source found so far is named `get_pending_direct_assignments()`, so this is unresolved.
- `driver_get_dispatch_state()`: client stores returned dispatch state.
- `driver_select_load(p_load_order_id)`: client contract documented in the v191 inventory; requires queue, driver/vehicle assignment, location freshness, and Ras Sedr geofence semantics.
- `driver_confirm_delivery(p_booking_id, p_latitude, p_longitude, p_accuracy_m, p_captured_at, p_actual_weight, p_scale_image_path, p_notes)`: client expects a successful JSON result containing `confirmed` and `actual_weight`. Historical five-argument definitions are not compatible with this call.
- `accept_direct_assignment(p_booking_id)`: client expects `accepted=true`, `acceptance_status='ACCEPTED'`, `accepted_at`, and ideally `trip_code`.
- `driver_check_in_queue(p_latitude, p_longitude, p_accuracy_m, p_captured_at)`: location accuracy/freshness and geofence checks must remain server-enforced.
- `driver_confirm_arrival(p_booking_id, p_latitude, p_longitude, p_accuracy_m, p_captured_at)`: current call has not been matched to a trustworthy migration source; unresolved.

## Confirmed schema incompatibilities
1. The clean baseline creates 14 core tables but no `driver_vehicle_assignments`; the queue and native tracking source require that relation and columns including `assigned_at` and `ended_at`.
2. Historical queue finalization inserts into `bookings.direct_acceptance_status`; the clean baseline's `bookings` table does not define this column.
3. Queue functions depend on `current_main_office_user()` and `write_audit_event()`; their authoritative definitions have not been recovered in the inspected sources.
4. Historical queue role checks include `BRANCH` in at least one read function, but the clean baseline `app_users.role` constraint only permits `ADMIN` and `HEAD_OFFICE`. Resolve intended read-only branch access without granting branch operational writes.
5. The historical queue migration schedules pg_cron. Keep scheduler installation separate from schema DDL and verify extension availability before any scheduling change.

## Gates before writing an executable bootstrap
- Pin the exact v191 source/build commit and use it as the client contract authority.
- Recover or deliberately reconcile each unresolved RPC source; do not add blind aliases.
- Decide the canonical driver/vehicle assignment table name and model.
- Define and test role checks, RLS, storage policies for `scale-tickets`, and least-privilege RPC grants.
- Run ordered migrations against a disposable clean PostgreSQL instance, followed by authenticated driver and head-office tests.
- Only after passing these gates, apply to the dedicated Shadow target and use a test-only Android build pointed at Shadow.

## Status
No migration applied to Shadow or Production by this audit. This document is a compatibility gate, not an executable migration or deployment approval.
