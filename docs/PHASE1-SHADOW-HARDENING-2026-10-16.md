# Tiba-Supplies Phase 1 Shadow Hardening — 2026-10-16

## Scope and safety

- Repository: `Midoelfawakhry/Tiba-Supplies`
- Branch: `shadow/phase1-hardening`
- Supabase target: Shadow project `awgppfjxegognuqozldl`
- Production remains untouched. No operational trips, queue entries, or sample loading records were inserted.

## Implemented and applied to Shadow

1. **Pending direct-assignment privacy**
   - The Ras Sedr branch snapshot excludes a direct booking while it is still `ASSIGNED` + `PENDING`.
   - The associated load order is hidden from branch available loads until the assigned driver accepts.
   - The branch driver directory continues to report the driver as busy while that private offer is pending; it does not falsely mark the driver available.

2. **Actual-weight notifications**
   - An `AFTER INSERT OR UPDATE OF actual_weight` trigger on `actual_loading_records` emits one `ACTUAL_WEIGHT_CONFIRMED` office notification for each of the MAIN and RAS_SEDR offices when a positive actual weight is first recorded.
   - The message includes trip code, weight, plate, factory, and quarry. Duplicate updates to an already-populated weight do not create a second notification for the same booking.
   - `branch_get_snapshot` and `main_office_get_dashboard` both expose office notifications.
   - The Main Office dashboard and Ras Sedr overview render those notifications.

3. **Dispatch winner/loser outcomes**
   - `driver_load_choices.outcome_reason` records the reason a selected driver was not allocated.
   - The finalizer revalidates queue state, account state, fresh/accurate GPS, geofence, vehicle linkage/availability, load availability, and remaining quantity in queue order.
   - Winners receive the requested trip-specific message with factory, quarry, and trip code.
   - Every selected choice that fails finalization is marked `NOT_ALLOCATED` with a persisted reason and receives `LOAD_REQUEST_NOT_ALLOCATED`.
   - `driver_get_dispatch_state` includes loser notifications and the stored outcome reason.
   - Driver UI renders dispatch notifications outside the geofence-only load-selection area; the 10 km rule still gates new load selection.

## Shadow database verification

Applied successfully through the Supabase Shadow connector:
- `phase1_branch_privacy_and_weight_notifications`
- `phase1_dispatch_outcome_notifications`
- `phase1_main_office_weight_notifications`
- `phase1_branch_directory_availability_guard`

Read-only metadata checks returned true for:
- branch RPC filters pending direct loads and allocations;
- Main Office snapshot exposes office notifications;
- driver dispatch snapshot exposes loser notifications;
- finalizer persists capacity-related outcomes;
- actual-weight notification trigger is installed;
- anonymous execution is denied for the branch snapshot RPC while authenticated execution is granted.

## Automated checks added

- `tests/phase1-branch-privacy-weight-notifications.test.mjs`
- `tests/phase1-dispatch-outcome-notifications.test.mjs`
- Both are included in `npm run test:phase1`.

## Still required before Phase 1 can be called release-ready

- GitHub CI build, TypeScript lint, and the complete Phase 1 test suite. The available workflow-run lookup did not return a run, so do not treat tests as passed.
- Runtime tests with isolated authenticated identities for: driver A cannot see/accept driver B's direct offer; pending direct offers remain absent from branch snapshots; acceptance reveals the trip; queue winners and all loser reasons produce the correct notifications; and repeated weight confirmation is idempotent.
- The one-minute `pg_cron` scheduler is active (`* * * * *`); recent job-run records show successful executions through 2026-10-16 05:13 UTC. Continue monitoring scheduler outcomes during runtime acceptance.
- Finish migration reconciliation between the divergent Shadow branch and database migration ledger before any release or merge.

**Release status: BLOCKED pending CI/runtime acceptance and migration reconciliation. No merge or Production deployment authorized.**
