# Native Tracking Branch Contract Comparison — 2026-10-16

## Scope and safety
Read-only comparison of `supabase/functions/driver-native-location/index.ts` on
`feat/native-location-v2-integration` and `shadow/phase1-tracking-release-fix`.
No code was changed, no Edge Function was deployed, and no database was modified.

## Material contract differences

### Feature branch: `feat/native-location-v2-integration`
- Reads assignments from `public.vehicle_driver_assignments`.
- Uses `assigned_to IS NULL` and `assigned_from <= now()`.
- Writes `driver_id`, `vehicle_id`, latitude/longitude, accuracy, heading/speed,
  `captured_at`, and `updated_at` to `driver_live_locations`.
- Missing `body.time` is replaced with server `Date.now()`, so a device timestamp is
  not strictly required.
- Missing accuracy is accepted as null.
- Checks rate limiting with a read of `last_seen_at` followed by a later update, which
  is not atomic under concurrent requests.
- Does not check the result of the update that revokes previous sessions before inserting
  a new tracking session.

### Shadow tracking branch: `shadow/phase1-tracking-release-fix`
- Reads assignments from `public.driver_vehicle_assignments`.
- Uses `ended_at IS NULL` and `assigned_at <= now()`.
- Writes `driver_id`, coordinates, accuracy, `captured_at`, and `received_at`, but does
  not persist the assigned `vehicle_id` in the location row.
- Also synthesizes missing device time and permits null accuracy.
- Uses the same non-atomic read-then-update rate-limit pattern.
- Does not check the prior-session revocation update result.

## Interpretation
These functions target different database contracts. Do not copy one function into the
other branch or deploy either version until the intended Shadow schema is established and
the exact table/column names are verified. The project manifest currently says Shadow has
no application tables, so there is no live Shadow schema here to validate these references
against yet.

The timestamp and accuracy behaviors conflict with the stated Phase 1 requirement that
driver eligibility depend on fresh, accurate, device-captured GPS. The missing vehicle ID
in the Shadow variant also weakens traceability of which assigned vehicle was associated
with the captured location.

## Required resolution
1. Establish the authoritative assignment table and active-assignment columns from the
   recovered base schema/approved schema export.
2. Establish the exact `driver_live_locations` contract and required columns.
3. Reject absent/non-numeric device capture time; reject missing accuracy if required by
   the dispatch eligibility contract; validate negative, over-limit, stale, and future values.
4. Enforce rate limiting atomically, preferably through a narrow database RPC/conditional
   update that cannot be bypassed by concurrent requests.
5. Check and handle session-revocation errors before creating a replacement session.
6. Add regression tests for token expiry/revocation, driver deactivation, assignment change,
   missing/stale GPS metadata, concurrent posts, and location-to-vehicle linkage.
7. Re-run CI and physical Android background tests after the code and schema contract agree.

## Status
- Branch contract comparison: completed.
- Canonical schema selected: no.
- Code changes / deploys: none.
- Production changes: none.
- Release approval: not granted.
