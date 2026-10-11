# Phase 1 Production Migration Readiness

Status: **NOT APPROVED FOR PRODUCTION** until all gates below pass.

## Non-negotiable production safeguards
- Do not apply migrations to production as part of this review.
- Do not import historical Excel/WhatsApp records into operational tables.
- Supabase production remains the source of truth; historical files are reference material only.
- Keep HEAD (Ismailia main office) as the operational input/dispatch office.
- Keep BRANCH (Ras Sedr) as the geofence/location reference only.
- Direct assignment stays pending until the driver explicitly accepts it; only acceptance creates the actual loading record.

## Repository migration hygiene
- Migration filenames must have unique version prefixes.
- Never rely on edits to migration versions already recorded in production; add a new forward-only corrective migration.
- Apply the migration set to a clean non-production database in filename order.
- Compare the resulting schema and function definitions against production before considering release.
- Inspect every SECURITY DEFINER RPC for explicit role/ownership checks and explicit EXECUTE grants.

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
- [ ] Unique migration versions and a reviewed migration manifest.
- [ ] Clean staging migration run succeeds.
- [ ] SQL regression tests pass, including negative authorization cases.
- [ ] App lint/build passes on the final commit.
- [ ] Staging smoke test passes with a linked test driver.
- [ ] Backup/restore or rollback procedure is documented and verified.
- [ ] Explicit release approval obtained before production changes.

## Known caveat
A successful frontend build does not prove database migration correctness. Production data and schema must remain untouched until the SQL and staging gates above pass.
