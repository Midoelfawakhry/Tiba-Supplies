# Phase 1 Clean-Chain CI Evidence — 2026-10-16

## Scope
Evidence recorded from GitHub Actions on branch `shadow/phase1-hardening`, commit `e607174183e3232300441937614021056e5827ca`. This is a candidate branch only. No merge to `main), no production deployment, and no Supabase migration application were performed.

## Verified CI results

| Check | Result | Evidence |
|---|---|---|
| Phase 1 Shadow CI | PASS | https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38970375176 |
| Disposable PostgreSQL baseline smoke | PASS | Job in the Phase 1 Shadow CI run above |
| Disposable PostgreSQL v191 clean-chain smoke | PASS | Job in the Phase 1 Shadow CI run above |
| Phase 1 build / tests / TypeScript / web build | PASS | https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38970375158 |
| Migration integrity | PASS | https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38970375111 |
| Signed Android Office, Branch, Driver builds | PASS | https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38970375071 |
| Windows Office portable package | PASS | https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38970375061 |

## Clean-chain coverage and limits
- The disposable PostgreSQL workflow replayed the clean v191 baseline and every timestamped migration at or after `20261014190000`, in filename/version order, excluding only `20261015186000_phase1_queue_scheduler.sql`.
- The excluded scheduler migration requires the managed Supabase `pg_cron` runtime; the local PostgreSQL smoke is not evidence that scheduler behavior was tested.
- Assertions verified required public RPC names, `driver_vehicle_assignments`, `dispatch_windows`, `waiting_list_entries`, and `driver_load_choices), and rejected the duplicate legacy `vehicle_driver_assignments` table name.
- Passing clean-chain smoke proves that the migration chain can be replayed in the disposable PostgreSQL fixture. It does not prove the same chain is safe to apply to a live project, nor does it replace transactional, authorization, geofence, or device tests.

## Build artifacts
Artifacts are attached to the successful GitHub Actions runs above.

### Android
- `tiba-supplies-office-signed-release-v205` — 3,565,563 bytes; artifact ID `12076238220`; expires 2026-11-15.
- `tiba-supplies-branch-signed-release-v205` — 3,528,721 bytes; artifact ID `12076089979`; expires 2026-11-15.
- `tiba-supplies-driver-signed-release-v205` — 3,526,536 bytes; artifact ID `12076338127`; expires 2026-11-15.

### Windows
- `Tiba-Supplies-Main-Office-Windows-x64` — 100,064,725 bytes; artifact ID `12076941161`; expires 2026-10-30.

Build success verifies artifact generation and upload, not installation or end-to-end operation on a physical device.

## Remaining release gates
1. Reconcile the candidate migration history and exact target-project migration ledger; do not blindly apply the repository folder to an existing project.
2. Run the reviewed SQL role/office-scope and transactional/concurrency matrix against a disposable managed Supabase staging project with synthetic identities and data.
3. Verify scheduler behavior in managed Supabase, since the local clean-chain smoke excludes `pg_cron`.
4. Install and smoke-test the three signed APKs, especially driver background location tracking, geofence freshness, queue eligibility, direct-assignment acceptance, weight-ticket upload, and notifications.
5. Inspect the Windows package on a test machine.
6. Review the post-test evidence and obtain explicit approval before any migration application. Keep production and the stable Android baseline untouched until then.

## Decision
**CI and build artifact generation are green for this commit. Release is not approved yet.** No live Supabase migration was applied as part of this verification.
