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
