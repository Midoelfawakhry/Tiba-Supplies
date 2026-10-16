# Tiba-Supplies — Latest Phase 1 Handover

**Updated:** 2026-10-17  
**Working branch:** `shadow/phase1-hardening`  
**Latest Phase 1 CI/build commit:** `ab3f7b3d64e3d52f0ad66f853adaaed2da05867b`  
**Latest README update before this revision:** `d2f921757ca4d80090a776a0437c9b89576ca843`

## Latest work completed

- Updated the project handover with the implementation summary, build status, artifacts, safety boundaries, and remaining tasks.
- Rechecked that Phase 1 Shadow CI and Phase 1 build succeeded on commit `ab3f7b3d`.
- Verified that migration-integrity, signed Android, and Windows packaging workflows completed successfully on commit `ecd39f6d`.
- Changes remain on `shadow/phase1-hardening`; no merge to `main` was performed.

### CI links

- [Phase 1 Shadow CI — success](https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38976381080)
- [Phase 1 build — success](https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38976380844)
- [Migration integrity — success](https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38976368567)
- [Signed Android builds — success](https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38976368540)
- [Windows Main Office build — success](https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38976368645)

## Implementation completed on the review branch

### Loading data and actual delivery

Migration: `supabase/migrations/20261017100000_phase1_separate_loading_data_from_actual_delivery.sql`

- Added `loading_data_records` for booking/assignment/loading-sheet information, kept separate from actual factory-delivery weight.
- Supports paper-origin actual-load rows without a booking when the date, vehicle, driver, quarry, and factory are identified.
- Adds provenance fields: `record_source`, `source_record_id`, `source_file_name`, `source_row_number`, and `imported_at`.
- Distinguishes driver-confirmed delivery, paper import, office correction, and legacy records. Existing records remain labeled as legacy evidence.
- Adds concurrency-safe daily numbering and duplicate-identity checks.

### Scale-ticket authorization

- Added scoped helper functions for upload, read, and delete authorization.
- Restricted helper execution to authenticated users and revoked public/anonymous execution.
- Updated Storage policies to use the scoped predicates.
- Limits deletion to the owning active driver for an in-transit booking before delivery confirmation.

### Test and SQL fixes

- Corrected SQL dollar quoting in the daily trip identity trigger.
- Corrected tests that check Main Office scope per reporting RPC.
- Added contract checks for scale-ticket grants and Storage policy references.

## Build artifacts

These artifacts were built from commit `ecd39f6d3af107f55ee13c4906997775d05188a2`, not the later contract-test commit `ab3f7b3d`.

- [Driver signed APK artifact](https://api.github.com/repos/Midoelfawakhry/Tiba-Supplies/actions/artifacts/12079515399)
- [Main Office signed APK artifact](https://api.github.com/repos/Midoelfawakhry/Tiba-Supplies/actions/artifacts/12079227414)
- [Ras Sedr Branch signed APK artifact](https://api.github.com/repos/Midoelfawakhry/Tiba-Supplies/actions/artifacts/12078613955)
- [Main Office Windows x64 artifact](https://api.github.com/repos/Midoelfawakhry/Tiba-Supplies/actions/artifacts/12078024834)

Successful build jobs do not replace installation/device smoke tests or authenticated database acceptance tests. GitHub artifact retention is time-limited.

## Remaining work — prioritized

### P0 — paper-load entry and import

The schema is prepared, but the complete office-facing workflow is still missing.

1. Build a Main Office screen for manual paper-load entry and CSV/spreadsheet import.
2. Add a server-authorized RPC; do not grant broad direct client write access to actual-load tables.
3. Validate Main Office role, load date, weight, vehicle, driver, factory, quarry, and source identity.
4. Add import preview, row-level validation errors, and audit metadata.
5. Make imports idempotent using stable source/file-row identity; report duplicates instead of silently inserting them.
6. Define correction/re-import behavior and test daily-number concurrency.
7. Test invalid references, unauthorized users, duplicate rows/files, partial failures, and concurrent inserts.

### P1 — safe Shadow database reconciliation

1. Re-read the intended Shadow schema and migration ledger.
2. Compare schema/ledger with the repository migration chain and document drift before repair.
3. Run migrations and database acceptance tests on disposable PostgreSQL first.
4. Only after review, decide whether to apply changes to the intended Shadow project.
5. Test office scope, driver delivery, reporting, scale-ticket upload/read/delete, and paper-import authorization with authenticated sessions.

### P1 — release validation

- Install and smoke-test Driver, Main Office, and Ras Sedr Branch APKs on Android.
- Verify login/logout, location permissions, background tracking, stale/inaccurate location behavior, and driver/vehicle assignment.
- Smoke-test the Windows package.
- Verify builds target Shadow, not Production.
- Rebuild final artifacts from the final candidate commit.
- Recheck the v191 AI assistant and native driver tracking remain intact.

### P2 — controlled data rollout

- Validate vehicle, driver, owner, factory, quarry, and office mappings before importing real paper records.
- Preserve source files and row-level provenance.
- Use isolated synthetic fixtures for volume tests; never seed shared databases with fake business records.
- Prepare rollback/recovery and a separate Production review before any live rollout.

## Safety boundaries

- Production Supabase remains read-only for this work; do not apply migrations or write SQL there.
- Work only on `shadow/phase1-hardening` unless explicitly authorized otherwise.
- Do not merge to `main` without explicit approval.
- Do not reset Shadow, remove its existing migration-ledger row, or drop the `ensure_rls` event trigger.
- Do not use the unrelated Supabase project as the Shadow target.
- Never put service-role credentials in client configuration.
- Preserve v191 AI assistant and native driver tracking; do not deploy an AI Edge Function or modify tracking as part of this schema task.
- Do not use PR 63 as a shortcut.

## Acceptance checklist

- [x] Phase 1 Shadow CI passed on `ab3f7b3d`.
- [x] Phase 1 build passed on `ab3f7b3d`.
- [x] Migration integrity, signed Android, and Windows workflows succeeded on `ecd39f6d`.
- [x] Scoped scale-ticket authorization helpers and contract checks added.
- [x] No Production database writes or migration were performed.
- [x] No merge to `main` was performed.
- [ ] Paper-load entry/import UI and secure RPC implemented.
- [ ] Duplicate prevention and import validation tests pass.
- [ ] Shadow schema/ledger reconciled and migration tested safely.
- [ ] Authenticated database acceptance tests pass against intended Shadow.
- [ ] Android and Windows smoke tests pass.
- [ ] Final release artifacts rebuilt and checked.
- [ ] Separate Production review and explicit authorization completed.

**Next action:** implement the secure Main Office paper-load entry/import workflow, then validate it against disposable PostgreSQL before changing Shadow.
