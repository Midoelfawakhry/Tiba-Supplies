# Shadow Phase 1 Audit — 2026-10-16

## Scope and safety
Read-only review of `Midoelfawakhry/Tiba-Supplies` branch `shadow/phase1-hardening` and the connected Supabase project `awgppfjxegognuqozldl` (Tiba Supplies Shadow). No database migrations, operational rows, branch merges, deployments, or production changes were performed during this audit.

## Verified findings

### Repository state
- `shadow/phase1-hardening` differs from `main`: GitHub compare reports **296 commits ahead and 9 behind**; status is `diverged`.
- PR #63 remains open and Draft. It is not mergeable (`dirty`) and must not be merged as part of this audit.
- The repository migration reconciliation note already records that the SQL migration directory is not a reproducible clean bootstrap: duplicated/date-only version prefixes, ledger entries without matching files, and the early live-core migration is not a complete schema.
- The branch contains a Shadow CI workflow for npm install, `npm run test:phase1`, `npm run lint`, and `npm run build`; however, the connected GitHub workflow-run lookup returned **no runs for commit `bf742e3999f3e857ec1299dd01dfffefbb303797`**. Therefore no CI pass is verified in this audit.
- The Android signed-release workflow is configured to build office, branch, and driver APKs and requires Android signing secrets. APK creation/signing is not verified by this audit.

### Supabase Shadow state
- Read-only migration ledger inspection shows a sequence of applied migrations, including manually named compatibility/repair entries and repeated direct-trip migration names. This confirms the live Shadow schema has history beyond a simple replay of the repository folder; do not recreate a fresh project by blindly applying the folder.
- The Shadow security advisor reports many `SECURITY DEFINER` RPCs executable by `authenticated`, plus leaked-password protection disabled. SECURITY DEFINER is not automatically a vulnerability, but each exposed function must be checked for server-side role/office authorization before production use.
- The performance advisor reports 28 foreign keys without covering indexes and one unused index. These are optimization follow-ups, not proof of functional failure.
- The current database has the expected dispatch functions and the actual-weight notification trigger. The notification/dispatch functions reviewed are not granted to anon; the two internal dispatch finalizer functions are not executable by authenticated users.
- An initial policy inventory query returned no rows for a set of table names; this does not establish that the tables lack security because policies may use other names or be enforced through RPCs. A complete RLS review is still required.

## Release gates still open
1. Reconcile the complete schema and migration history into a deterministic, uniquely versioned bootstrap strategy for a fresh, separate Supabase project.
2. Verify every exposed SECURITY DEFINER function has explicit authorization and safe `search_path`; remediate findings only after reviewing intended office/driver access.
3. Run the Shadow CI workflow and record actual run IDs and outcomes. No passing run is claimed here.
4. Build and install the Android APKs, including native driver tracking validation, against Shadow configuration.
5. Perform end-to-end acceptance using dedicated test identities and synthetic records only: direct assignment acceptance/privacy, queue eligibility/geofence, winner/loser outcomes, actual-weight notifications, delivery gate, reports, and cancellation/redirect lifecycle.
6. Only after the above gates pass, transfer the verified application and canonical schema to the new isolated project/repository.

## Decision
**Not ready for clean-project transfer or release yet.** Keep the existing Primary project untouched. Keep PR #63 Draft and do not merge.