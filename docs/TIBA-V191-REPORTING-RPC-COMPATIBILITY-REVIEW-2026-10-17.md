# Tiba-Supplies v191 — Reporting RPC Compatibility Review

Date: 2026-10-17
Branch: `shadow/phase1-hardening`
Scope: read-only inspection of live Production RPC definitions and source/client contracts. No database writes, migrations, resets, or deployments were performed.

## Executive result

| RPC | Live Production result shape | Current reviewed client expectation | Result |
|---|---|---|---|
| `get_account_statement_records(date,date)` | JSON array of actual-loading records | JSON array; filters by factory/quarry and date | Shape-compatible; schema/source generation still must be reconciled |
| `get_vehicle_owner_reports(date,date)` | JSON object with `vehicles`, `owners`, `trips` arrays | Same object and arrays | Shape-compatible; use the latest trip-code revision, not the older migration variant |
| `get_office_waiting_list()` | Legacy JSON array of waiting rows | Object with `entries` array and `selection_window` | **Incompatible** with the current office UI |

## Live Production observations (read-only)

All three functions exist in `public`, are `SECURITY DEFINER`, use `search_path=public`, and have ACLs showing execution for `postgres` and `authenticated`. Their bodies perform an explicit `auth.uid()` check and role checks; do not treat that as proof that every authorization path is safe without negative tests.

### 1. `get_account_statement_records(p_from date, p_to date)`

- Returns a JSON array (empty array when no rows match).
- Current live fields include `actual_load_id`, `booking_id`, `trip_code`, `daily_load_number`, `loading_sequence_date`, `load_date`, `created_at`, `ticket_number`, `actual_weight`, vehicle/driver/factory/quarry IDs and names, and `delivery_confirmed_at`.
- Rejects unauthenticated callers, users without an active `ADMIN` or `HEAD_OFFICE` role, and reversed date ranges.
- The reviewed `AccountStatementsScreen.tsx` consumes an array and filters by `factory_id` or `quarry_id`; its weight total counts only rows with `delivery_confirmed_at`.
- Source history contains an older version with fewer trip-identity fields and a later weight-only/trip-code revision. The clean bootstrap must use one deliberately reconciled definition, not copy the older variant blindly.

### 2. `get_vehicle_owner_reports(p_from date, p_to date)`

- Returns an object with `vehicles`, `owners`, and `trips` arrays.
- Live trip records include trip identity, daily loading number/date, owner and vehicle details, driver/factory/quarry details, actual weight, scale-image path, delivery confirmation time, booking status, and `is_completed`.
- Rejects unauthenticated callers, users without an active `ADMIN` or `HEAD_OFFICE` role, and reversed date ranges.
- The reviewed `VehicleOwnerReportsScreen.tsx` expects this object and those arrays. Its completed-trip totals require `is_completed` and a non-null actual weight.
- The earliest located migration variant differs from the live implementation (including role allowance and trip identity fields). The later trip-code revision is the more relevant source candidate, but it still must be reconciled to the canonical schema and tested.

### 3. `get_office_waiting_list()`

- Live Production returns a JSON array of rows with `entry_id`, `driver_id`, `driver_name`, `vehicle_id`, `plate_number`, `status`, and `arrived_at`.
- Live Production authorizes active `ADMIN` / `HEAD_OFFICE` users and selects the first active office with `office_type='BRANCH'`.
- The reviewed `OfficeDirectoryScreen.tsx` expects `data.entries` and `data.selection_window`; a legacy array therefore becomes an empty UI list even if rows exist.
- The newer historical queue/UI migration returns the expected object shape, including the selection-window metadata and richer queue-entry fields. It depends on `dispatch_windows`, `driver_load_choices`, the newer `driver_vehicle_assignments` relation, and helper functions that are not present in the clean baseline. It also uses a different app-user role model. It must not be applied independently.

## Bootstrap implications

1. Keep the account-statement array contract and owner-report object contract explicit in a machine-checkable RPC manifest.
2. Treat the waiting-list return-shape mismatch as a release-blocking compatibility issue for any client paired with the legacy Production function.
3. Select the queue implementation only after the canonical schema, role model, assignment relation, helper functions, and queue tables are reconciled. Do not solve this by adding a blind alias or creating duplicate assignment tables.
4. Rebuild a disposable PostgreSQL database from the proposed ordered migration chain, then run catalog assertions and authorization tests for unauthenticated, driver, branch, and head-office identities. Include empty/non-empty results, reversed date ranges, and cross-office access attempts.
5. Keep the Shadow target isolated. Production remains read-only; no migration, reset, restore, merge to `main`, or deployment is authorized by this review.
6. Preserve the v191 AI assistant, native background tracking, and signed Android release workflow unchanged.

## Source references

- `src/components/AccountStatementsScreen.tsx`
- `src/components/VehicleOwnerReportsScreen.tsx`
- `src/components/OfficeDirectoryScreen.tsx`
- `supabase/migrations/20261011105953_account_statement_records_head_only.sql`
- `supabase/migrations/20261011001729_vehicle_owner_reports.sql`
- `supabase/migrations/20261011125650_20261011180000_weight_only_trip_codes.sql`
- `supabase/migrations/20261010_vehicle_live_tracking.sql`
- `supabase/migrations/20261015180000_phase1_queue_selection_and_atomic_dispatch.sql`
- `supabase/migrations/20261015181000_phase1_queue_ui_and_concurrency_hardening.sql`

This document records source and live-catalog findings; it is not an executable migration or deployment approval.
