# Supabase ↔ GitHub Foundation Sync

## Purpose

Keep the Tiba-Supplies application code, SQL migration files, and the live Supabase schema aligned during foundation work. The absence of real bookings, loading records, or driver/employee accounts is expected at this stage; do not seed fake operational data just to make the database look populated.

## Current baseline (read-only audit, 2026-10-11)

- Supabase project: `tnlcvwtphbunteifoonc`; project health was reported as active/healthy.
- The production migration registry was extended after the reviewed rollout. The newly applied migrations were recorded by Supabase with versions `20261011125635`, `20261011125637`, `20261011125640`, `20261011125643`, `20261011125645`, `20261011125650`, `20261011125652`, and `20261011125655`.
- The applied migrations are being normalized to local filenames whose 14-digit version prefixes match the actual Supabase migration registry. Their suffix retains the original reviewed migration filename so the audit trail remains traceable. Older legacy/non-standard filenames still need a separate baseline reconciliation.
- The HEAD redirect migration was given a unique version and aligned to the version recorded by Supabase; it reasserts the corrected redirect implementation after the cancellation/redirect rules migration.
- The branch snapshot/employee RPCs and trip identity columns/counter triggers have now been applied and verified in production. A read-only database regression check confirmed role gates and branch-scoped direct assignments; full end-to-end app testing is still required.

## Safety boundary

- Do not auto-deploy database migrations on a push.
- Do not run a broad `db push` against production while the migration baseline is unresolved.
- Never place `service_role` or `sb_secret_...` keys in the app or GitHub client-side variables. Frontend configuration uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Do not create a Supabase development branch for this project unless the project owner changes that decision.
- Do not create fake driver/employee accounts or operational loading records as test fixtures in production.
- Branch app access must not be issued until the branch-specific read RPCs are deployed and the full main-office snapshot is restricted to ADMIN/HEAD_OFFICE.

## Required rollout sequence

1. Continue reconciling older legacy migration filenames and the production migration registry by matching actual SQL effects and function definitions—not filenames alone.
2. Replay the normalized migration set against an isolated disposable PostgreSQL/Supabase test environment and run full SQL/security tests.
3. Deploy required Edge Functions only after their database dependencies exist.
4. Verify migration history, expected columns/functions, role gates, Supabase security/performance advisors, and the app's RPC calls after deployment.
5. Build and test the office, driver, and branch apps against the resulting schema before distributing accounts or production APKs.

## Migration integrity CI

`.github/workflows/migration-integrity.yml` checks that SQL files using the standard 14-digit timestamp format do not share a version. Legacy filenames are reported for reconciliation rather than silently treated as deployed or unapplied.
