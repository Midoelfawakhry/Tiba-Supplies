# v191 RPC Permission Audit — 2026-10-16

## Scope and safety

Read-only catalog/function review of the Supabase project embedded in the signed Android v191 APK: `awgppfjxegognuqozldl` (Tiba Supplies Shadow). The separate production project `tnlcvwtphbunteifoonc` was not queried or changed. No SQL writes, migrations, grants, function deployments, or data mutations were performed.

## Confirmed positive controls

- The reviewed `SECURITY DEFINER` functions use a fixed `search_path` of `pg_catalog, public` or, for older operational functions, `public`.
- The reviewed exposed `SECURITY DEFINER` RPCs have no explicit `PUBLIC EXECUTE` ACL and none of the inspected functions is executable by `anon`.
- Main-office operational RPCs generally delegate authorization to `current_main_office_user()`, which requires an active `ADMIN`/`HEAD_OFFICE` user associated with active `MAIN` / `HEAD_OFFICE` office.
- Branch snapshot delegates to `current_ras_sedr_branch_user()`, which requires an active `BRANCH` user associated with the active `RAS_SEDR` branch.
- Driver tracking RPC `driver_update_live_location(double precision, double precision, double precision, timestamptz)` requires `auth.uid()`, an active driver mapped to that auth user, valid coordinate ranges, accuracy <= 100 m, and a capture time within the accepted freshness window. It upserts only the caller's driver row.
- `get_vehicle_live_locations()` checks the authenticated app user's role and scopes branch users to vehicles whose `office_id` matches their own office. It derives the vehicle from the active driver/vehicle assignment, matching the v191 table contract.
- No exposed `SECURITY DEFINER` function in the catalog query had an explicit PUBLIC execute ACL. `anon` execute was false for every exposed function in the reviewed result set.

## Findings

### F-01 — Branch role can call a global owner/trip report RPC (needs scoped authorization)

Function: `public.get_vehicle_owner_reports(p_from date, p_to date)`

The function accepts any active `ADMIN`, `HEAD_OFFICE`, or `BRANCH` role, then returns owner, vehicle, and trip/actual-loading report data across all rows. Unlike `get_vehicle_live_locations()`, it does not constrain a branch user's output by `app_users.office_id` / `vehicles.office_id`. In the current target dataset, all 139 vehicles are assigned to `RAS_SEDR` and there is one active branch account, so the query did not demonstrate a present cross-branch leak. However, the function is not future-safe if another branch is added or records become multi-office. Recommended narrow remediation: either restrict this report to `ADMIN`/`HEAD_OFFICE` using the same role/office authorization policy as other main-office reporting, or explicitly filter vehicles/trips to the caller's office when role = `BRANCH`. Before changing it, check the UI call path and intended branch-report requirements. No fix applied.

### F-02 — Waiting-list RPC authorizes any branch role but always returns RAS_SEDR

Function: `public.get_office_waiting_list()`

The function allows active `ADMIN`, `HEAD_OFFICE`, or `BRANCH` users based on role, then always returns the `RAS_SEDR` branch queue. There is currently only one branch office and one branch account in this target project, so no current cross-branch exposure was demonstrated. For multi-branch readiness, consider replacing the broad role check with `current_ras_sedr_branch_user()` for branch users (while retaining the main-office roles if they are intended to view the queue). No fix applied.

### F-03 — Legacy account-statement RPC uses role-only office authorization

Function: `public.get_account_statement_records(p_from date, p_to date)`

The function requires an authenticated, active `ADMIN` or `HEAD_OFFICE` app user, but does not check that the user's `office_id` is the active `MAIN` / `HEAD_OFFICE` office. Current target data has one `ADMIN / MAIN` account and no `HEAD_OFFICE` account, so no present unauthorized path was demonstrated. Recommended remediation is to use the canonical main-office authorization helper, after confirming the intended roles and frontend caller. No fix applied.

## Other reviewed functions

- `get_vehicle_live_locations()`: role gate plus branch office filter present.
- `get_vehicle_owner_directory()`: restricted to active `ADMIN` / `HEAD_OFFICE`.
- `get_branch_employee_directory()`: calls `current_main_office_user()`.
- `get_phase1_snapshot()`: role-gated to `ADMIN` / `HEAD_OFFICE`, but remains a broad legacy snapshot; verify frontend usage before further privilege decisions.
- `create_operational_driver(...)` and `update_operational_vehicle(...)`: legacy functions contain authenticated role checks. Do not change their grants based only on their age; inspect call sites and actual grants first.
- Driver queue and booking mutation RPCs inspected use authenticated driver identity checks and/or office authorization helpers. The sample was a catalog/function-source review, not a full dynamic penetration test.

## Recommended next steps

1. Trace frontend call sites for `get_vehicle_owner_reports`, `get_office_waiting_list`, `get_account_statement_records`, and `get_phase1_snapshot`.
2. Decide whether branch users are intended to see global owner/trip reports. Prefer the smallest role/office-scoped correction that matches the UI.
3. Test driver tracking with the phone screen locked and verify that `received_at` continues to advance in the office map. This remains a device acceptance test, not something a catalog audit can prove.
4. Apply a narrowly scoped migration only after the call-path review, and only to `awgppfjxegognuqozldl`. Do not enable RLS globally, broadly revoke grants, or deploy these changes to production.

## Result

The v191 driver tracking RPC contract remains compatible with the target backend based on static schema/function review. Three authorization-hardening candidates were identified; none was modified. This report contains no driver coordinates or other precise location values.
