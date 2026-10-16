# Tiba-Supplies — Phase 1 Shadow Handover

**Last updated:** 2026-10-17  
**Working branch:** `shadow/phase1-hardening`  
**Latest reviewed commit:** `ab3f7b3d64e3d52f0ad66f853adaaed2da05867b`  
**Status:** Phase 1 hardening checks pass. This is **not** authorization to deploy, merge to `main`, or change Production.

> هذا الملف هو سجل التسليم الحالي: ما تم تنفيذه، وما تم اختباره، وما لا يزال مطلوبًا قبل اعتماد الإصدار.

## 1. Safety boundaries — do not bypass

- Work on `shadow/phase1-hardening` only unless a separate instruction authorizes another branch.
- Do **not** merge to `main` without explicit approval.
- Production Supabase project: `tnlcvwtphbunteifoonc`. Treat as **read-only** for this work; do not apply migrations or write SQL there.
- Intended Shadow project: `bvyxiahpxogblkmtjxyx`. Verify its schema and migration ledger before any migration is applied.
- Do not reset Shadow, remove its existing migration-ledger row, or drop its `ensure_rls` event trigger.
- Do not use the unrelated project `awgppfjxegognuqozldl` as the Shadow target.
- Never place service-role credentials in browser, web, or Android client configuration.
- Preserve the working v191 AI assistant, native driver background tracking, and signed Android workflow. This schema work does not authorize deploying an AI Edge Function or changing native tracking.
- Do not use PR 63 as a shortcut.
- Never create fake operational records in a shared database to make the UI look populated. Use isolated synthetic fixtures for tests.

## 2. Work completed on the review branch

### A. Phase 1 loading-data and actual-delivery separation

Migration added:

`supabase/migrations/20261017100000_phase1_separate_loading_data_from_actual_delivery.sql`

- Introduces `loading_data_records` as a separate record of assignment/loading-sheet information linked to a booking, load order, driver, vehicle, factory, quarry, and trip code.
- Allows `actual_loading_records` to represent historical paper records that have no booking, while requiring the associated date, vehicle, driver, quarry, and factory identity.
- Adds source/provenance fields such as `record_source`, `source_record_id`, `source_file_name`, `source_row_number`, and `imported_at`.
- Distinguishes driver-confirmed delivery from paper imports, office corrections, and legacy rows. Existing records are labeled `LEGACY` rather than being misrepresented as new driver-confirmed deliveries.
- Adds per-day loading numbers and a concurrency-safe daily counter, plus uniqueness checks for daily identity and trip codes.
- Preserves the distinction between a load assignment/status and the actual weight recorded at the factory. Do not infer actual weight merely from an assignment.

### B. Paper-loading entry and CSV import

- Added a Main Office screen inside the existing **التحميل الفعلي** workflow for entering a paper-recorded load without creating a fake booking or driver delivery confirmation.
- The manual form validates date, vehicle, driver, factory, quarry, and positive actual weight, then calls the restricted `main_office_record_paper_actual_load` RPC.
- Added CSV file reading, required-header validation, a row-count limit, and a preview before submitting the import through `main_office_import_paper_loads`.
- CSV import requires `load_date, vehicle_code, driver_code, factory_code, quarry_code, actual_weight`; optional columns are `ticket_number, notes, source_record_id`.
- The server validates the whole file before inserting rows, records source file/row provenance, skips exact repeats, rejects reused source identities whose business values changed, assigns daily trip identity, and writes audit events.
- Added contract tests for the manual-entry authorization and provenance path.
- **Not yet proven:** the new SQL has not been applied to the intended Shadow database; the CSV/manual flows are not ready for operational use until database migration reconciliation and authenticated integration testing are complete.

### C. Scale-ticket storage authorization

- Added narrowly scoped `SECURITY DEFINER` predicates: `can_upload_scale_ticket(text)`, `can_read_scale_ticket(text)`, and `can_delete_scale_ticket(text)`.
- Pinned function search paths and limited execution grants to authenticated users; public/anonymous execution is revoked.
- Updated Storage policies to use these predicates rather than relying on direct access to RPC-only tables.
- Deletion is restricted to the active driver who owns the relevant booking, while the booking is in transit and delivery has not been confirmed.

### D. Test and SQL corrections

- Fixed malformed SQL dollar quoting in `assign_actual_loading_trip_code()`.
- Corrected lifecycle test assertions so each reporting RPC's Main Office scope is checked explicitly.
- Added v191 contract-gate checks for the scale-ticket helper grants and Storage-policy references.
- Added/retained contract coverage for paper-import provenance and duplicate-source protection.

### E. Documentation and traceability

- Recorded paper-import provenance and the remaining import-workflow gap in commit history.
- Kept the changes isolated to the review branch; no merge to `main` was performed as part of this work.

## 3. Verified checks and build outputs

Latest confirmed CI on commit `ab3f7b3d`:

- [Phase 1 Shadow CI — success](https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38976381080)
- [Phase 1 build — success](https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38976380844)

Additional checks on the preceding application-code commit `ecd39f6d`:

- [Migration integrity — success](https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38976368567)
- [Signed Android builds — success](https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38976368540)
- [Windows Main Office build — success](https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38976368645)

The signed Android workflow produced these artifacts (built from `ecd39f6d`; artifact retention is time-limited):

- [Driver signed APK artifact](https://api.github.com/repos/Midoelfawakhry/Tiba-Supplies/actions/artifacts/12079515399)
- [Main Office signed APK artifact](https://api.github.com/repos/Midoelfawakhry/Tiba-Supplies/actions/artifacts/12079227414)
- [Ras Sedr Branch signed APK artifact](https://api.github.com/repos/Midoelfawakhry/Tiba-Supplies/actions/artifacts/12078613955)
- [Main Office Windows x64 artifact](https://api.github.com/repos/Midoelfawakhry/Tiba-Supplies/actions/artifacts/12078024834)

**Important:** workflow success proves that the configured checks/build jobs completed. It does not prove that the APKs install and work on a real device, that all database RPC authorization paths pass against the intended Shadow database, or that the application is production-ready. The artifact binaries above are from `ecd39f6d`; the later `ab3f7b3d` commit adds contract-gate checks and does not itself represent a newly rebuilt artifact set.

## 4. Remaining work — recommended order

### P0 — finish the paper-loading workflow

The schema supports paper-only actual-load records, but a complete office-facing entry/import workflow is still missing. Implement:

1. A Main Office screen to enter a paper load manually and import a spreadsheet/CSV.
2. A server-authorized RPC for create/import; do not grant clients broad direct table-write access.
3. Strict Main Office authorization, field validation, and explicit mapping of vehicle, driver, factory, quarry, date, weight, and source.
4. Idempotency using stable source identity (file + row/source ID); detect duplicates and report rejected rows without silently duplicating data.
5. Audit metadata and a preview/validation report before committing an import.
6. Safe daily trip-number allocation and clear handling of corrections/re-imports.
7. Tests for duplicate files/rows, invalid references, unauthorized roles, partial failures, and concurrent inserts.

### P1 — reconcile and test Shadow database safely

1. Read the current intended Shadow schema and migration ledger again.
2. Reconcile the existing ledger and schema against the repository's clean migration chain; document drift before proposing a change.
3. Run the migration and database acceptance tests against a disposable PostgreSQL database first.
4. Only after that review, decide whether and how to apply the migration to the intended Shadow project. Do not touch Production.
5. Run authenticated integration tests for Main Office, Branch Office, drivers, scale-ticket upload/read/delete, reporting RPCs, and paper-import permissions.

### P1 — release validation

- Install and smoke-test all three signed Android APKs (Main Office, Ras Sedr Branch, Driver).
- Verify login/logout, Android location permissions, background tracking, stale/low-accuracy location behavior, and driver-to-vehicle assignment on a real device.
- Smoke-test the Windows Main Office package.
- Verify that all builds point to the intended Shadow environment and contain no Production URL/key.
- Re-run the release checks on the final commit and archive the resulting artifacts and checksums.
- Verify v191 AI assistant behavior and existing native tracking remain intact.

### P2 — operational data and rollout

- Design the controlled import/migration of real paper records; keep source files and row-level provenance for audit.
- Validate truck/vehicle, driver, owner, factory, quarry, and office mappings before importing operational data.
- Test realistic daily volumes using isolated fixtures (the project target discussed includes around 100 trucks/day and a 15-day trial); do not seed the shared database with invented business records.
- Prepare a rollback/recovery plan and a separate, explicit Production migration review before any live rollout.

## 5. Acceptance checklist

- [x] Phase 1 Shadow CI passed on `ab3f7b3d`.
- [x] Phase 1 build passed on `ab3f7b3d`.
- [x] Migration-integrity, signed Android, and Windows build workflows completed successfully on `ecd39f6d`.
- [x] Scale-ticket authorization helper and Storage-policy contract checks added.
- [x] Changes remain on `shadow/phase1-hardening`; no merge to `main` in this work.
- [x] No Production migration or write was performed in this work.
- [x] Paper-load manual entry form and CSV import UI/RPC added on the review branch (runtime database validation remains pending).
- [ ] Intended Shadow schema/ledger reconciled and migration safely validated.
- [ ] Authenticated database acceptance tests passed against the intended Shadow target.
- [ ] Android and Windows real-device/installation smoke tests passed.
- [ ] Final artifact set rebuilt and validated on the final release candidate.
- [ ] Explicit Production deployment review and authorization completed.

## 6. Change history highlights

Recent branch commits include:

- `ab3f7b3d` — enforce scoped scale-ticket Storage policies in contract tests.
- `ecd39f6d` — authorize scale-ticket Storage through scoped RPC predicates.
- `8e5f56c4` — correct SQL dollar quoting in the trip identity trigger.
- `8ea011aa` — assert office scope per reporting RPC.
- `60b11470` — document paper-import provenance and remaining workflow gap.
- `01427b28` — retain paper-import source identifiers and provenance.
- `b0377b2c` — document daily loading identity and concurrency-safe counter.

## 7. Working principle

**Keep the real operational data safe.** Complete the paper-import workflow and Shadow reconciliation first; verify database permissions and app behavior with controlled tests; only then consider a separately approved release. A green build is necessary, but not sufficient, for production deployment.


## 8. Paper-load CSV contract

Use UTF-8 CSV with a header row. Required columns:

```csv
load_date,vehicle_code,driver_code,factory_code,quarry_code,actual_weight
2026-10-17,TRK-001,DRV-001,FAC-01,QUA-01,32.500
```

Optional columns: `ticket_number`, `notes`, `source_record_id`.

- `load_date` must be an ISO date (`YYYY-MM-DD`).
- Codes must match the existing directory codes exactly (case-insensitive matching is performed server-side).
- Weight is in tons and must be greater than zero and no more than 1000.
- The CSV filename plus logical data-row number is retained as import provenance; re-importing the same file name skips already imported source rows.
- Do not rename/relabel a different spreadsheet to the same filename unless it is intentionally the same source file. Preserve the original source file and the import summary for audit.
- The screen currently offers a first-row preview and whole-file server validation. Real-world spreadsheet acceptance and authenticated database tests remain release gates.
