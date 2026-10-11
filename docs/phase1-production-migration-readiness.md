# Phase 1 Production Migration Readiness

Status: **NOT APPROVED FOR PRODUCTION** until all gates below pass.

## Non-negotiable production safeguards
- Do not apply migrations to production as part of this review.
- Do not import historical Excel/WhatsApp records into operational tables.
- Supabase production remains the source of truth; historical files are reference material only.
- Keep HEAD (Ismailia main office) as the operational input/dispatch office.
- Keep BRANCH (Ras Sedr) as the geofence/location reference only.
- Direct assignment stays pending until the driver explicitly accepts it; only acceptance creates the actual loading record.

## Current audit findings (2026-10-11)
- The latest reviewed branch head is `38a2c53bb548ccf5bde2fef5d30f133a88b67242`; PR #13 remains open and draft.
- The previously reported duplicate `20261011014000` filename is no longer present in the current branch listing; the current file is `20261011014000_enforce_head_office_write_permissions.sql`. Keep this as a verified fix, but re-run collision checks on the final candidate commit.
- Migration naming is still inconsistent: the repository contains several date-only prefixes such as `20261010_...` and multiple files beginning `20261011_...`, while production's migration ledger contains 14-digit versions. Do not run a clean staging migration until every migration has a unique, deterministic version and the repo-to-production migration mapping is reconciled. Do not bulk-rename files blindly: migration ordering and whether each change has already been applied must be established first.
- `20261011014000_enforce_head_office_write_permissions.sql` rewrites function source using text replacements. This is brittle and must not be accepted as the final authorization control until every target function/signature is checked and the migration fails closed when a role gate is not found. Prefer explicit reviewed function definitions or a tested, signature-aware patch.
- The direct-assignment flow is intended to create a `BOOKED` offer, with an actual loading record created only after the assigned driver accepts. This must be proven by database tests, including concurrent acceptance.
- The current driver snapshot migration includes both `updated_at` and `captured_at` freshness checks. Confirm the same rule in every eligibility/dispatch RPC and test stale/future timestamps.
- Production currently has no linked driver auth accounts, no active vehicle-driver assignments, no live location rows, and no actual loading records. End-to-end driver/GPS acceptance cannot be verified against production; use a separate test environment with synthetic test records.
- Production migration history has not been changed during this review. No production migration has been applied.

## Latest review-branch correction (candidate only)

- Added `supabase/migrations/20261011150000_rebuild_head_owned_cancellation.sql` as a new forward-only candidate. It replaces the cancellation RPC definition explicitly rather than rewriting role-gate source text.
- Candidate cancellation resolves the active HEAD office, verifies the booking belongs to HEAD operational ownership, cancels the booking, clears active queue rows for the driver, and requeues eligible vehicles under HEAD only. Standalone direct assignments are checked against their HEAD-owned audit row; BRANCH is not selected as a queue office.
- Updated `supabase/tests/phase1_direct_assignment_security_checks.sql` to correct the role-gate regex escapes and add static checks for HEAD-owned cancellation. These checks are still **not executed**; static definition checks do not prove transactional/concurrency behavior.
- This candidate has not been run against staging or production. Before approval, validate the exact queue uniqueness constraints, test rollback and concurrent cancellation, and verify that all operational write RPCs use HEAD consistently. Production remains unchanged.

## Repository migration hygiene
- Migration filenames must have unique version prefixes.
- Never rely on edits to migration versions already recorded in production; add a new forward-only corrective migration.
- Reconcile every repository migration against the production migration ledger before deciding what staging should replay.
- Apply the migration set to a clean non-production database in the intended order.
- Compare the resulting schema and function definitions against production before considering release.
- Inspect every SECURITY DEFINER RPC for explicit role/ownership checks and explicit EXECUTE grants.
- Do not merge PR #13 or apply production migrations until all release gates pass.

## Required SQL regression cases
1. HEAD can create and directly assign a load; BRANCH cannot create, dispatch, cancel, redirect, or edit operational driver/vehicle records.
2. Unauthenticated and driver users cannot call office mutation RPCs.
3. Direct assignment creates a BOOKED offer and audit row, but no actual loading record before acceptance.
4. Only the assigned driver can accept; repeated or concurrent acceptance creates exactly one actual loading record.
5. A driver’s own pending direct assignment remains visible outside the geofence; available loads and queue state do not.
6. Missing, stale, future-dated, and outside-radius GPS points are rejected consistently by every eligibility path.
7. Cancelling an eligible pre-delivery booking requires a reason, preserves audit history, and returns the driver to the end of the queue once; out-of-service vehicles are not re-queued.
8. Cancellation is rejected after transit/delivery or after weight/delivery evidence is recorded.
9. Redirect changes the current destination on the same actual-loading row, requires a reason, and does not persist the previous destination in audit payloads.
10. Delivery requires positive actual weight and a scale-ticket image; duplicate delivery confirmation is rejected.
11. Only delivered trips with confirmed weight contribute to reports.
12. No duplicate active booking, duplicate queue entry, or duplicate actual-loading record can be produced by retries/concurrent requests.

## Device / operational smoke test
- Link at least one test driver auth account and an active vehicle-driver assignment in staging.
- Send a fresh device-captured GPS point and verify in-radius and out-of-radius cases.
- Test Android background/foreground location behavior; build success alone does not validate background GPS.
- Verify notification, driver acceptance, delivery ticket upload, and final report end-to-end.

## Release gates
- [ ] Migration inventory and repo-to-production version mapping approved.
- [ ] Unique migration versions and a reviewed migration manifest.
- [ ] Authorization migration no longer relies on unverified text replacements.
- [ ] Clean staging migration run succeeds.
- [ ] SQL regression tests pass, including negative authorization cases.
- [ ] App lint/build passes on the final commit.
- [ ] Staging smoke test passes with a linked test driver.
- [ ] Backup/restore or rollback procedure is documented and verified.
- [ ] Explicit release approval obtained before production changes.

## Known caveat
A successful frontend build does not prove database migration correctness. Production data and schema must remain untouched until the SQL and staging gates above pass.
