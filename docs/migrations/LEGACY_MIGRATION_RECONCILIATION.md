# Legacy migration reconciliation

## Scope and safety

This inventory reconciles the repository's SQL files with the production Supabase migration history observed on 2026-10-11. It is documentation only: it does not alter production data, the Supabase migration history table, or any SQL migration contents.

Do not delete a migration-history row just because a later migration replaced its effects. Do not run a legacy SQL file against production to test it. A missing effect must be addressed with a reviewed, forward-only corrective migration.

## Production versions with a clear repository candidate

The version prefix is the authoritative key used by Supabase migration tracking. The repository filenames below have historically differed from production versions and need careful normalization only after reviewing file content and dependencies.

| Production version | Current repository file | Disposition |
| --- | --- | --- |
| 20261010182259 | supabase/migrations/20261010182259_office_edit_driver_vehicle.sql | Filename aligned in this PR to the recorded production version; SQL content preserved unchanged. |
| 20261011001729 | supabase/migrations/20261011001729_vehicle_owner_reports.sql | Filename aligned in this PR to the recorded production version; SQL content preserved unchanged. |
| 20261011001852 | supabase/migrations/20261011001852_office_cancel_redirect_booking.sql | Filename aligned in this PR to the recorded production version; SQL content preserved unchanged. |
| 20261011001910 | supabase/migrations/20261011001910_prevent_cancel_loaded_trip.sql | Filename aligned in this PR; current cancellation behavior was superseded by a later head-office-owned implementation. SQL content preserved unchanged. |
| 20261011002050 | supabase/migrations/20261011002050_booking_destination_history.sql | Filename aligned in this PR. Its table was intentionally removed by a later migration; keep this historical step for clean bootstrap order. |
| 20261011002215 | supabase/migrations/20261011002215_simplify_redirect_storage.sql | Filename aligned in this PR. Later storage design superseded prior destination-history storage; keep this historical step for clean bootstrap order. |
| 20261011002708 | supabase/migrations/20261011002708_phase1_cancel_queue_duplicate_guard.sql | Filename aligned in this PR to the recorded production version; SQL content preserved unchanged. Duplicate queue guard remains in the current cancellation path. |
| 20261011003338 | supabase/migrations/20261011003338_prevent_duplicate_delivery_confirmation.sql | Filename aligned in this PR to the recorded production version; SQL content preserved unchanged. Ordering follows the production history. |
| 20261011003819 | supabase/migrations/20261011003819_driver_geofence_status_helper.sql | Version aligned. |
| 20261011004304 | supabase/migrations/20261011004304_validate_captured_driver_location_time.sql | Version aligned. |
| 20261011105953 | supabase/migrations/20261011105953_account_statement_records_head_only.sql | Version aligned. |
| 20261011125635 | supabase/migrations/20261011125635_20261011150000_rebuild_head_owned_cancellation.sql | Version aligned with production's recorded version prefix. |
| 20261011125637 | supabase/migrations/20261011125637_20261011151000_dispatch_from_head_queue.sql | Version aligned with production's recorded version prefix. |
| 20261011125640 | supabase/migrations/20261011125640_20261011152000_cancel_in_transit_redirect_delivered.sql | Version aligned with production's recorded version prefix. |
| 20261011125643 | supabase/migrations/20261011125643_20261011153000_head_owned_booking_redirect.sql | Version aligned with production's recorded version prefix. |
| 20261011125645 | supabase/migrations/20261011125645_20261011160000_branch_office_accounts_readonly_app.sql | Version aligned with production's recorded version prefix. |
| 20261011125650 | supabase/migrations/20261011125650_20261011180000_weight_only_trip_codes.sql | Version aligned with production's recorded version prefix. |
| 20261011125652 | supabase/migrations/20261011125652_20261011190000_direct_assignment_trip_identity.sql | Version aligned with production's recorded version prefix. |
| 20261011125655 | supabase/migrations/20261011125655_20261011193000_direct_assignment_identity_lookup.sql | Version aligned with production's recorded version prefix. |

## History versions with no same-version local SQL file

The following versions exist in production history but have no same-version filename in the current main branch:

- `20261011004642_require_captured_driver_location_time`
- `20261011020800_phase1_direct_assignment_acceptance_head_owned`
- `20261011022028_enforce_head_office_write_permissions_fail_closed`

Read-only production inspection found their expected behavior present in current function definitions (captured-time validation, direct assignment, and head-office-only write permissions). The original SQL source was not found at the expected paths in the current repository. Before attempting a reconstruction, search all reachable branches/tags and commit history. If source recovery fails, add a clearly labeled archival reconstruction only when its content can be independently derived and reviewed; never pretend it is the original applied file.

## Legacy filenames that are not migration-versioned

The following 14-digit-version-less files remain under `supabase/migrations/`. Some are foundational SQL needed for a fresh install; do not move them out of the active directory until a clean-database bootstrap plan or baseline migration has been validated.

- `20261009_phase1_live_core.sql`
- `20261010_add_owner_name_to_available_vehicles.sql`
- `20261010_create_load_order_rpc.sql`
- `20261010_create_operational_driver.sql`
- `20261010_create_operational_vehicle.sql`
- `20261010_direct_load_assignment.sql`
- `20261010_driver_portal_geofence.sql`
- `20261010_separate_operational_and_checkin_offices.sql`
- `20261010_standalone_direct_assignment.sql`
- `20261010_vehicle_live_tracking.sql`
- `20261010zz_repair_vehicle_tracking_rpc_schema_cache.sql`

After the version-alignment changes in this PR, 11 non-standard filenames remain. The pair `20261010_vehicle_live_tracking.sql` and `20261010zz_repair_vehicle_tracking_rpc_schema_cache.sql` is nearly identical; the latter additionally requests a PostgREST schema-cache reload. Keep it out of any replay plan unless a clean-bootstrap test proves it is required.

## Recommended order of work

1. Recover the three missing historical SQL sources from all reachable Git refs and commit history.
2. Verify candidate files against each migration's reviewed SQL and dependencies.
3. Align filenames to recorded production version prefixes only after that verification.
4. Establish and test a clean-database bootstrap path before moving foundational legacy files to an archive directory.
5. Add a CI gate that prevents new non-standard migration filenames, then gradually retire the legacy set.
6. Apply no production changes as part of this repository reconciliation.
