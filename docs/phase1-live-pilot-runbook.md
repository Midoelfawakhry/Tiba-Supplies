# Phase 1 Controlled Live Pilot Runbook

**Purpose:** Validate the real Tiba-Supplies loading cycle with a very small number of real vehicles and drivers, without paying for a separate Supabase branch. This is a controlled pilot plan, not authorization to deploy or mutate production.

## Non-negotiable safeguards

- Do not apply candidate migrations or merge the release PR until the production migration ledger has been reconciled with the repository and the exact SQL changes have been reviewed.
- Take and verify a recoverable database backup/snapshot before the approved pilot release; record who can restore it and the recovery steps.
- Agree on a short pilot window with the office team. Do not run unrelated live dispatches through the pilot workflow during that window.
- Use only 3 selected vehicles and their named drivers for pilot records. Keep all other drivers/vehicles out of the pilot workflow.
- Do not fabricate weights, tickets, GPS locations, delivery confirmations, or financial/accounting records. Label any deliberately simulated step as a simulation and never report it as a real load.
- Keep the current production app and database unchanged until the preflight gate below is signed off.
- Prepare a rollback/stop procedure before starting. If a safety gate fails, stop new assignments and preserve logs; do not delete operational history to make a test pass.

## Gate 0 — Before the pilot is scheduled

- [ ] Confirm current production app version, deployed database functions, and current migration ledger.
- [ ] Reconcile all filename/version mismatches; compare candidate SQL with live definitions. Do not replay or rename historical migrations by guesswork.
- [ ] Confirm backup/snapshot and recovery procedure.
- [ ] Confirm the pilot changes are reviewed and all latest CI checks are green.
- [ ] Confirm the intended role model: HEAD office (Ismailia) owns operational loading/dispatch actions; BRANCH office (Ras Sedr) is the check-in/geofence reference and remains read-only for restricted operational writes.
- [ ] Confirm that each pilot driver has a real, correctly linked authenticated account and is active; verify vehicle ownership/driver assignment data.
- [ ] Record the selected 3 vehicle IDs/plates, driver IDs, operator, start time, and the person authorized to stop the test.
- [ ] Confirm the team can identify pilot test loads and distinguish them from ordinary live loads without corrupting real records.

**Do not start** if driver accounts are not linked, backup recovery is unverified, migration history is unresolved, or the pilot data cannot be safely distinguished from ordinary operations.

## Gate 1 — Small pilot cohort

Select three vehicles:
- **Vehicle A:** active driver checked in within the configured Ras Sedr radius.
- **Vehicle B:** another active driver within the radius, used for queue/competition and duplicate-action checks.
- **Vehicle C:** driver deliberately outside the radius, used only to verify ineligibility; do not assign a real load to this vehicle while outside.

Do not assume the GPS value alone proves a driver is physically present. Confirm device location permission, captured timestamp, and operator observation.

## Gate 2 — End-to-end test matrix

For every case, record the timestamp, actor/role, expected result, actual result, relevant IDs, and screenshots/log references. Do not store passwords or tokens in the run log.

| ID | Scenario | Expected result |
|---|---|---|
| P01 | HEAD user signs in | Authorized office dashboard and master directory are accessible |
| P02 | BRANCH user signs in | Only branch-scoped/read-only views are available; restricted write RPCs fail server-side |
| P03 | Create/edit factory and quarry | HEAD-only; required fields validated; duplicate normalized codes/names rejected; audit log records changes |
| P04 | Driver A sends fresh GPS inside radius | Eligible for the correct Ras Sedr check-in office only |
| P05 | Driver C is outside radius | No eligible loads/queue entry; direct attempt to bypass UI is rejected by the server |
| P06 | Missing, stale, or future GPS timestamp | Driver is ineligible; no load is exposed/assigned |
| P07 | HEAD publishes a pilot load for the correct check-in office | Only eligible drivers scoped to that office can see it; other office scope cannot see it |
| P08 | Driver A books/receives direct assignment | Assignment remains BOOKED/pending acceptance; no actual-loading record is created before acceptance |
| P09 | Driver A accepts assignment once | Exactly one acceptance and one associated actual-loading record are created transactionally |
| P10 | Repeat accept/tap or retry same request | No duplicate booking, acceptance, or actual-loading record |
| P11 | Drivers A and B compete for one remaining slot | Capacity is never exceeded; one valid result per available slot |
| P12 | Record actual ticket and weight | Correct vehicle, driver, factory, quarry, date, trip code, and daily loading number are stored |
| P13 | Cancel before acceptance / cancel after acceptance | Valid state transitions only; queue cleanup is atomic and no duplicate waiting entry appears |
| P14 | Redirect/requeue a permitted booking | Correct target and office scope; prior destination/history is preserved |
| P15 | Confirm delivery | Correct booking/load is finalized once; duplicate delivery confirmation is rejected |
| P16 | Review audit/reporting | Events and actual loading records reconcile with the paper ticket and office log |

For concurrency and duplicate-action cases, use two devices/operators only if the operation can be performed without risking an unintended real dispatch. Otherwise mark them **not tested** and do not claim success.

## Gate 3 — Reconciliation after the pilot

- [ ] Compare every pilot booking with the physical paper ticket and actual loading sheet.
- [ ] Reconcile per-vehicle counts, driver identity, factory/quarry, weight, trip code, daily loading number, and delivery state.
- [ ] Check for duplicate bookings, duplicate loading rows, stuck queue entries, incorrect office visibility, and missing audit events.
- [ ] Review errors and logs with sensitive credentials removed.
- [ ] Mark each scenario PASS / FAIL / NOT TESTED; attach evidence and record the operator who verified it.
- [ ] Do not scale beyond the 3-vehicle cohort until all critical cases pass and any failure is fixed and retested.

## Stop conditions

Stop new pilot assignments immediately if:
- a driver outside the geofence sees or receives a load;
- BRANCH can execute a restricted HEAD-only write;
- a booking creates an actual-loading row before acceptance;
- duplicate bookings/loading rows or duplicate daily codes appear;
- a vehicle/driver/factory/quarry/weight is mismatched;
- cancellation/redirect damages queue integrity;
- the pilot cannot be distinguished from ordinary live loads; or
- the recovery plan is unavailable.

## Evidence status

This runbook is a proposed operational test plan. No pilot has been executed by this document, no production migration has been applied by this work, and CI success alone is not evidence that the real loading cycle passes.