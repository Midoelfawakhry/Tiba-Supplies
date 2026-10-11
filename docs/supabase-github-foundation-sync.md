# Supabase ↔ GitHub Foundation Sync

## Purpose

Keep the Tiba-Supplies application code, SQL migration files, and the live Supabase schema aligned during foundation work. The absence of real bookings, loading records, or driver/employee accounts is expected at this stage; do not seed fake operational data just to make the database look populated.

## Current baseline (read-only audit, 2026-10-11)

- Supabase project: `tnlcvwtphbunteifoonc`; project health was reported as active/healthy.
- The production migration registry currently ends at version `20261011105953` (`account_statement_records_head_only`).
- The repository contains legacy/non-standard migration filenames and some migration effects were recorded in Supabase under different version/name pairs. Therefore, a filename-only comparison must not be treated as a complete list of unapplied migrations.
- A duplicate 14-digit migration version was found for the HEAD redirect migration. The repository change renames that file to `20261011153000_head_owned_booking_redirect.sql`, immediately after `20261011152000_cancel_in_transit_redirect_delivered.sql`.
- Confirmed production gaps from the read-only audit include the trip identity columns/counter triggers and the dedicated branch snapshot/employee directory RPCs. Verify live schema and function definitions before deciding what to apply.

## Safety boundary

- Do not auto-deploy database migrations on a push.
- Do not run a broad `db push` against production while the migration baseline is unresolved.
- Never place `service_role` or `sb_secret_...` keys in the app or GitHub client-side variables. Frontend configuration uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Do not create a Supabase development branch for this project unless the project owner changes that decision.
- Do not create fake driver/employee accounts or operational loading records as test fixtures in production.
- Branch app access must not be issued until the branch-specific read RPCs are deployed and the full main-office snapshot is restricted to ADMIN/HEAD_OFFICE.

## Required rollout sequence

1. Reconcile legacy migration filenames and the production migration registry by matching actual SQL effects and function definitions—not filenames alone.
2. Replay the normalized migration set against an isolated disposable PostgreSQL/Supabase test environment and run SQL/security tests.
3. Deploy required Edge Functions only after their database dependencies exist.
4. Apply only the reviewed, ordered migrations to production after the migration plan and expected impact are clear.
5. Verify migration history, expected columns/functions, role gates, Supabase security/performance advisors, and the app's RPC calls after deployment.
6. Build and test the office, driver, and branch apps against the resulting schema before distributing accounts or production APKs.

## Migration integrity CI

`.github/workflows/migration-integrity.yml` checks that SQL files using the standard 14-digit timestamp format do not share a version. Legacy filenames are reported for reconciliation rather than silently treated as deployed or unapplied.
