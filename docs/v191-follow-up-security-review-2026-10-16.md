# v191 Follow-up Security Review — 2026-10-16

## Scope and change safety
Review target is Supabase project `awgppfjxegognuqozldl`, the backend embedded in signed Android v191. The separate production project `tnlcvwtphbunteifoonc` was not changed. No SQL migration was applied. The signed v191 artifacts were not replaced.

## Confirmed frontend call paths
- `VehicleOwnerReportsScreen.tsx` calls `get_vehicle_owner_reports` and `main_office_get_directory`; it is rendered from `LiveOperationsBoard.tsx` as a main-office screen.
- `AccountStatementsScreen.tsx` calls `get_account_statement_records` plus `getLiveSnapshot()`; it is rendered from the main-office board.
- `OfficeDirectoryScreen.tsx` calls `get_office_waiting_list`; it is used by the main-office board for the waiting queue.
- `BranchOfficeApp.tsx` uses `get_branch_office_snapshot`, the dedicated branch read-only snapshot.

## Findings
1. `get_vehicle_owner_reports` only checks that the active user has a role in ADMIN/HEAD_OFFICE/BRANCH, then returns all vehicle/owner and trip report rows. Frontend call path is main-office-only, so the primary defect is an overly broad server authorization gate, not evidence that the current UI exposes it to branch users.
2. `get_account_statement_records` checks active ADMIN/HEAD_OFFICE role but does not delegate to the canonical `current_main_office_user()` helper, which also checks the active MAIN/HEAD_OFFICE office association.
3. `get_office_waiting_list` checks role but always returns the RAS_SEDR queue. It should validate BRANCH against `current_ras_sedr_branch_user()` and ADMIN/HEAD_OFFICE against `current_main_office_user()`.
4. AI Edge Function audience guard previously checked that a BRANCH profile belonged to any active branch office, not specifically the RAS_SEDR branch. The source on this review branch now additionally requires `office_code = 'RAS_SEDR'`; its authorization regression test was updated accordingly.

These are authorization hardening findings. No current cross-branch disclosure has been demonstrated in the existing single-branch dataset.

## Prepared, not applied
- `supabase/migrations/20261016150000_phase1_rpc_office_scope_hardening.sql` scopes the three RPCs above.
- `supabase/tests/phase1_rpc_office_scope_hardening_checks.sql` adds definition/ACL checks.
- Neither file has been applied to the target database. Definition-level CI passing is not equivalent to executing these checks against the target database or testing real role sessions.

## CI and deploy status
- Phase 1 Shadow CI passed after the AI branch-office guard change: https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38924377919
- Phase 1 build passed after the same change: https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38924377411
- Shadow AI deployment workflow failed before deployment because the Supabase access token lacks `edge_functions_read`: https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38924372105
- The workflow log confirms the CLI received HTTP 403 for missing `edge_functions_read`. No new AI Edge Function version was deployed by this run.
- Signed APK and Windows builds triggered by the latest commit were still in progress at the time of this review.

## Required next actions
1. Grant the repository's `SUPABASE_ACCESS_TOKEN` the needed Edge Functions read permission in addition to the intended deploy permission, then rerun the Shadow AI deploy workflow. Never place the token in source code or chat.
2. Confirm deployment by checking the deployed Edge Function version/hash and run authenticated HEAD_OFFICE/BRANCH smoke tests; verify that non-RAS_SEDR branch profiles are rejected.
3. Run the RPC hardening migration and SQL checks only in the isolated v191 Shadow target after reviewing the migration diff and having a rollback plan. Do not deploy this migration to production automatically.
4. Verify signed APK and Windows build runs complete successfully before treating those artifacts as release candidates.
5. Review the Supabase Auth leaked-password-protection warning as a separate configuration change; it was not changed during this work.

## Current state
No database migrations, production deployment, or changes to production data were made during this follow-up. Source changes remain on `shadow/phase1-hardening`.
