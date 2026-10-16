# v191 follow-up status — 2026-10-16

## Verified status
- The user-confirmed working v191 AI assistant remains the behavioral baseline.
- Phase 1 build and Shadow CI passed on the restored authorization-test commit `1d296b780aec8099cecbc7f843ac5b3fd10fa0e6`.
- The documentation-only head commit `6275c9dc0b96d3caf264b4e3921c8d072b28ff71` also passed Phase 1 build and Shadow CI.
- The signed Android release workflow `38924964078` and Windows portable EXE workflow `38924964149` were still reported in progress by GitHub Actions at the latest inspection; do not claim their artifacts are ready. The Android workflow had not yet published artifacts.
- The AI deploy workflow failed due to a Supabase access token missing the `edge_functions_read` permission. No new AI Edge Function deployment was confirmed.
- Read-only inspection of the v191 target backend `awgppfjxegognuqozldl` confirms the helper functions `current_main_office_user()` and `current_ras_sedr_branch_user()` exist alongside the three reviewed RPCs.

## Candidate RPC scope hardening
Prepared migration:
`supabase/migrations/20261016150000_phase1_rpc_office_scope_hardening.sql`

Definition-level checks:
`supabase/tests/phase1_rpc_office_scope_hardening_checks.sql`

The candidate narrows owner reports and account statements to the main-office helper and requires the office waiting-list function to validate either the main office or the RAS_SEDR branch. It explicitly revokes anon/PUBLIC execution and grants authenticated execution for these RPCs. This is still a candidate: the migration and SQL checks have NOT been applied or run on the target project. Do not apply until reviewed against the exact deployed function bodies and tested in an isolated copy of the v191 backend.

## No production changes
No schema changes, migration applications, Edge Function deployments, or production data writes were performed during this review.
