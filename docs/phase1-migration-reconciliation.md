# Phase 1 Migration Reconciliation

Status: **BLOCKED — inventory only; do not deploy this manifest**.

This file records the current repository-to-production comparison so migration cleanup can be performed without replaying or skipping schema changes. It is not a migration script.

## Production migration ledger (read-only snapshot, 2026-10-11)

| Production version | Production name | Repository candidate | Assessment |
|---|---|---|---|
| `20261010182259` | `office_edit_driver_vehicle` | `20261010181742_office_edit_driver_vehicle.sql` | Similar purpose, version differs; compare file content and deployed definition before mapping |
| `20261011001729` | `vehicle_owner_reports` | `20261011_vehicle_owner_reports.sql` | Likely counterpart; version is not preserved in repository filename |
| `20261011001852` | `office_cancel_redirect_booking` | `20261011_office_cancel_redirect_booking.sql` | Likely counterpart; verify exact content |
| `20261011001910` | `prevent_cancel_loaded_trip` | `20261011_prevent_cancel_loaded_trip.sql` | Likely counterpart; verify exact content |
| `20261011002050` | `booking_destination_history` | `20261011_booking_destination_history.sql` | Likely counterpart; verify exact content |
| `20261011002215` | `simplify_redirect_storage` | `20261011_simplify_redirect_storage.sql` | Likely counterpart; verify exact content |
| `20261011002708` | `phase1_cancel_queue_duplicate_guard` | `20261011_phase1_cancel_queue_duplicate_guard.sql` | Likely counterpart; verify exact content |
| `20261011003338` | `prevent_duplicate_delivery_confirmation` | `20261011003500_prevent_duplicate_delivery_confirmation.sql` | Similar purpose, version differs; compare exact SQL |
| `20261011003819` | `driver_geofence_status_helper` | `20261011003819_driver_geofence_status_helper.sql` | Version/name match |
| `20261011004304` | `validate_captured_driver_location_time` | `20261011004304_validate_captured_driver_location_time.sql` | Version/name match |
| `20261011004642` | `require_captured_driver_location_time` | **No exact filename found in current migration directory listing** | Investigate whether its effect was folded into another file, omitted, or lost; do not assume it is unnecessary |

## Filename hygiene findings

The repository also contains multiple date-only migration prefixes (for example, several `20261010_...` files and several `20261011_...` files). A migration runner that treats the numeric prefix as the version can see collisions. Before staging replay:

1. Inventory every file and derive the exact version the deployed migration runner will parse.
2. Compare each file byte-for-byte or semantically against its recorded production migration.
3. Preserve applied history; do not rename/replay an already-applied migration as if it were new.
4. Give only genuinely new forward migrations unique, ordered versions.
5. Resolve missing production-ledger counterparts explicitly.
6. Run the final manifest against an isolated clean database before release.

## Release-blocking SQL review items

- Replace the broad source-text role-gate rewriting approach with explicit, reviewed function definitions or a signature-aware, fail-closed migration.
- Verify BRANCH cannot execute operational mutation RPCs even when invoked directly, not just through hidden UI controls.
- Verify every SECURITY DEFINER function has a correct internal role/ownership gate, fixed search path, and least-privilege EXECUTE grants.
- Verify direct assignment remains pending until driver acceptance and concurrent retries cannot create duplicate actual-loading rows.
- Verify cancellation, redirect, queue re-entry, and delivery work for both load-order bookings and standalone direct assignments.
- Test missing, stale, future-dated, and out-of-radius GPS using the same eligibility rules throughout the database.

## Safety

- This reconciliation is read-only documentation; it does not alter Supabase.
- Historical Excel/WhatsApp data remains reference-only.
- Production remains unchanged until staging and release gates pass.

## Confirmed live-definition findings (read-only production inspection, 2026-10-11)

The following are observations from the current production function definitions, not assumptions based on repository files:

- `direct_assign_standalone_load(uuid,uuid,uuid)` currently allows `ADMIN`, `HEAD_OFFICE`, and `BRANCH`; it creates the booking as `LOADING_STATEMENT` and inserts `actual_loading_records` immediately. This conflicts with the intended explicit driver-acceptance workflow and HEAD-only assignment rule.
- Production `create_operational_driver`, both observed `create_operational_vehicle` overloads, `update_operational_driver`, `update_operational_vehicle`, `dispatch_load`, `office_cancel_booking`, and `office_redirect_booking` definitions include BRANCH in their role gates. The release migration must close those server-side paths, not merely hide UI actions.
- Production `office_cancel_booking` assumes a load-order booking and derives the queue office through `load_orders`; a standalone direct booking has `load_order_id IS NULL`. The branch cancellation implementation must be tested for standalone bookings and for queue uniqueness before acceptance.
- Production `update_driver_live_location` already rejects missing, stale, or future `p_captured_at` values. This must be reconciled with migration `20261011004642_require_captured_driver_location_time` and the repository's freshness patches before replaying anything.
- Production has no linked driver auth accounts, no live GPS rows, no active vehicle-driver assignments, and no actual-loading rows in the inspected snapshot. Therefore, production cannot provide a meaningful driver end-to-end test; use isolated staging with synthetic fixtures.

## Next gate before any migration is approved

1. Obtain a complete exact inventory of migration files and production ledger versions.
2. Reconcile the missing `require_captured_driver_location_time` ledger entry and the version mismatches.
3. Review the actual definitions and signatures affected by the role-gate patch. The patch must fail closed if any expected function or role condition differs.
4. Run the migration sequence on isolated staging, then test role denial for BRANCH, direct assignment pending/acceptance, duplicate acceptance, GPS freshness/geofence, cancellation/requeue, redirect, delivery, and reports.
5. Keep PR #13 in draft and do not apply migrations to production until the above evidence is recorded and the user explicitly authorizes a production rollout.

## Follow-up changes on the review branch

- Hardened `20261011014000_enforce_head_office_write_permissions.sql` so it fails if an expected write RPC is missing and refuses to guess when a BRANCH role-gate pattern differs. This reduces silent partial application risk, but does not replace a staging run against the exact schema.
- Added `supabase/tests/phase1_direct_assignment_security_checks.sql` with read-only definition checks for pending direct assignment, explicit acceptance, BRANCH write denial, and fixed search paths.
- These SQL checks have **not yet been executed against a clean staging database**. GitHub Actions checks frontend lint/build only; their success is not evidence that SQL migrations or SQL assertions pass.
- The latest SQL migration inventory still needs reconciliation with production history, especially the ledger entry `20261011004642_require_captured_driver_location_time` that has no matching repository filename. No production migration was applied.

## Additional queue-office integrity finding (review branch, 2026-10-11)

The current candidate cancellation function in `20261011014000_enforce_head_office_write_permissions.sql` resolves the queue office for a standalone direct assignment by selecting the first active `BRANCH` office ordered by name. The direct-assignment audit row records the operational `HEAD` office in `office_id`; it does not record the specific branch/geofence office used at assignment time. The production inventory also found no unique constraint limiting active `BRANCH` offices to one.

**Risk:** if more than one active BRANCH office exists, cancellation can requeue the driver under a different branch from the one used for eligibility and location. The current behavior is deterministic by name, but not necessarily operationally correct.

**Required resolution before staging sign-off:**
1. Choose and document the invariant: either exactly one active BRANCH office, enforced by a database constraint/index, or persist the selected `geofence_office_id` on each direct-assignment audit record.
2. If persisting the branch reference, use a new forward migration and backfill only where the historical association is provable; do not infer missing history.
3. Add staging cases with zero, one, and two active BRANCH offices; cancellation must fail closed or requeue to the assignment's recorded branch.
4. Verify the cancellation queue cleanup and insertion remain atomic and preserve one active queue entry per driver/office.

This is a static review finding. No SQL migration or SQL regression test has been executed against staging, and production remains unchanged.

## Read-only production checks (2026-10-11, no writes performed)

The following checks were executed using SELECT-only queries and Supabase advisory inspection. They are live observations, not staging test results.

- Office configuration: one active HEAD office (Ismailia) and one active BRANCH office (Ras Sedr); BRANCH has coordinates and a 10,000 m radius. HEAD has no coordinates, which is consistent with HEAD being the operational office rather than the geofence reference.
- Operational data snapshot: 153 drivers, 138 vehicles, 0 drivers linked to auth users, 0 active vehicle-driver assignments, 0 live-location rows, 0 bookings, 0 active waiting-list entries, 0 actual-loading records, and 0 historical-loading-staging rows. This confirms that live end-to-end dispatch/acceptance tests cannot be meaningfully run with existing production data.
- The listed critical RPCs are SECURITY DEFINER and their definitions include a fixed `search_path` setting. This check only confirms the setting is present; it does not prove the role logic is safe.
- The live definitions for the listed write RPCs still contain the term `BRANCH`. Since BRANCH is also a legitimate geofence reference, a text match alone is not proof of authorization; exact role predicates must be reviewed per function. The earlier production definition audit did find BRANCH in role gates, so server-side authorization remains a release blocker until proven otherwise.
- A read-only query of `pg_policies` returned no policies for the sampled operational tables (`bookings`, `actual_loading_records`, `standalone_direct_load_audit`, `waiting_list_entries`, `driver_live_locations`, `drivers`, `vehicles`). RLS is enabled on these tables. This may be intentional if all access is through SECURITY DEFINER RPCs, but it requires a deliberate access-path review before launch; do not add broad policies as a quick fix.
- Supabase security advisor reports leaked-password protection is disabled. Review and enable it in Auth settings if compatible with the app's sign-in flow.
- Supabase performance advisor reports 20 foreign keys without covering indexes, including several on actual loading, audit, driver location, and load-order tables. These are performance findings, not proof of incorrect behavior. Prioritize indexes based on actual query patterns and validate each candidate before changing production.
- The advisory output also flags SECURITY DEFINER functions exposed to authenticated users. This warning is generic; each RPC must be reviewed for intentional exposure, internal authorization, ownership checks, and least-privilege grants.

## Safe-check execution status

- Completed: read-only migration ledger retrieval; read-only schema/column/foreign-key inventory; read-only office and operational count queries; read-only function metadata checks; read-only policy inventory; Supabase security and performance advisor retrieval.
- Not executed: the SQL regression script in `supabase/tests/phase1_direct_assignment_security_checks.sql`, because it is a DO block that raises errors and is intended to validate a fully reconciled migration set; running it against production is not an acceptable substitute for staging.
- Not executed: role-based RPC calls, booking acceptance, cancellation, redirect, delivery, or queue mutation tests, because they would require synthetic auth identities/data and could mutate production.
- No schema changes, data writes, migration applications, PR merges, or production releases were performed during these checks.
