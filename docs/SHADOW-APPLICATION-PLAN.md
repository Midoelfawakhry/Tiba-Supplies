# Tiba-Supplies Shadow Application — Phase 1

**Status:** Shadow branch created; isolation and test setup in progress.  
**Branch:** `shadow/phase1-hardening`  
**Base:** current `main` at branch creation.  
**Production policy:** no production database changes, no merge, and no release build from this branch until the release gates below pass.

## Goal

Use a parallel copy of the Tiba-Supplies application to harden the current workflow and data model without disturbing the tested production application. This is a controlled release candidate, not a replacement of production until explicitly approved.

## Isolation rules

1. Frontend code and fixes are developed on this branch only.
2. Shadow builds must use a dedicated Supabase staging project with separate Auth users, database, Storage buckets, Edge Functions, and secrets.
3. Never put production URL, publishable key, service-role key, or production Auth users into Shadow configuration.
4. Keep secrets out of Git. Use environment variables configured only for the Shadow build.
5. Never run candidate SQL against production. Candidate migrations stay outside the production migration path until reviewed.
6. Keep historical Excel/WhatsApp records as reference data; do not import them as live bookings/loading records for tests.
7. Keep the three app variants separate: Office, Driver, and Ras Sedr Branch. Only signed release APKs are release artifacts; do not replace the currently tested location-tracking build during this work.
8. Keep unrelated changes separated, especially driver text corrections and background GPS tracking. Cherry-pick only after independent validation.

## Proposed workstreams

### A. Schema and migration integrity
- Inventory staging schema and migration ledger.
- Reconcile migration filename/version mismatches and missing historical source files.
- Do not recreate or rename historical migrations from memory.
- Build a clean staging bootstrap and compare effective schema with the inspected live definition.

### B. Authorization and RPC hardening
- Enumerate every public SECURITY DEFINER function by exact signature, including overloads and trigger helpers.
- For each function record caller roles, identity/ownership checks, office scope, fixed search_path, execute ACLs, data returned, mutation effects, and audit trail.
- Keep branch users read-only and limited to their intended branch snapshot.
- Remove direct execute grants from internal helpers only after verifying callers and dependencies.
- Review special table privileges and default privileges; do not blindly revoke.

### C. Office and geofence correctness
- Use persisted office identity from a load's `check_in_office_id` or the driver's active `driver_office_assignments`, not `ORDER BY name LIMIT 1`.
- Define what happens when zero or multiple active office assignments exist; fail closed rather than silently selecting one.
- Apply the same location freshness and radius rules to check-in, available loads, direct assignment, dispatch, and queue re-entry.
- Keep the operational HEAD office separate from the Ras Sedr BRANCH check-in office.

### D. Loading workflow correctness
- Verify load creation does not silently assign a driver or vehicle.
- Verify direct assignment remains pending until driver acceptance.
- Prevent duplicate trip codes, duplicate active driver/vehicle assignment, double acceptance, over-dispatch, duplicate delivery confirmation, and invalid cancellation/redirect requeue.
- Preserve actual loading records and audit history.

### E. Data minimization and reports
- Decide whether branch driver directory is branch-scoped or intentionally global.
- Return only fields needed for that business purpose.
- Test account statements and vehicle-owner reports against role, date, and office boundaries.

## Required acceptance matrix

| Area | Required test |
|---|---|
| Authentication | Anonymous calls to protected RPCs fail closed |
| Role boundaries | BRANCH cannot call HEAD/ADMIN write RPCs directly |
| Office scope | Loads, queue, reports, and directory use the correct persisted office |
| GPS | Missing, stale, future, and out-of-radius coordinates are rejected |
| Assignment | Direct offer remains pending until the assigned driver accepts |
| Concurrency | Parallel dispatch/acceptance cannot exceed quantity or create duplicates |
| Actual loading | One actual record per intended trip; delivery cannot be confirmed twice |
| Cancellation/redirect | Queue re-entry keeps correct office and audit history |
| Data exposure | Snapshot/report contains no out-of-scope records or unnecessary private fields |
| Build | Lint and web build pass |
| Android | Office, Driver, and Ras Sedr Branch signed release builds smoke-tested separately |
| Background tracking | Verify login/logout, app backgrounding, recent-apps removal, permission denial, and stale-location behavior on the target HONOR device |

## Promotion path

1. Finish the read-only live inventory.
2. Provision an isolated staging Supabase project and configure Shadow-only environment variables.
3. Apply only reviewed, forward-only candidate migrations to staging.
4. Run SQL assertions, role-based RPC tests, and application tests against staging fixtures.
5. Run lint/build and device smoke tests for each app variant.
6. Produce a change report listing every file/migration changed and the reason.
7. Review the release candidate and explicitly approve the release.
8. Only then merge selected commits and apply the corresponding reviewed migrations to production in a controlled release window.
9. Run post-release smoke tests and retain rollback instructions.

## Current blockers / prerequisites

- A dedicated Supabase staging project is needed before any SQL mutation or end-to-end database test. Do not point Shadow at production.
- The production migration ledger still needs semantic reconciliation with repository files.
- Existing production data does not provide meaningful driver GPS/acceptance/concurrency fixtures; create synthetic fixtures only in isolated staging.
- This document is a plan and guardrail, not proof that tests have passed or that the database is isolated yet.
