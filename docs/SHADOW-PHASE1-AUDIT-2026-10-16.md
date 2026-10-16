# Shadow Phase 1 Audit — 2026-10-16

## Scope and safety
Read-only review of `Midoelfawakhry/Tiba-Supplies` branch `shadow/phase1-hardening` and connected Supabase project `awgppfjxegognuqozldl` (Tiba Supplies Shadow). No operational rows, branch merges, production deployments, or Primary database changes were performed.

## Verified findings

### Repository and CI
- The branch differs from `main`: GitHub compare reported **296 commits ahead and 9 behind** at the time of comparison; status is `diverged`.
- PR #63 remains open and Draft; do not merge while migration history is unreconciled.
- A real GitHub Actions run has now completed successfully for commit `72e64069d114a2a7f39683e2646519c700af9f50`: [Phase 1 Shadow CI run #232](https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38859892352).
- Verified successful workflow steps: dependency installation, `npm run test:phase1`, `npm run lint` (TypeScript check), and `npm run build`. This confirms those checks passed for that exact commit, not runtime behavior against real authenticated users.
- The Android signed-release workflow is configured for office, branch, and driver APKs and requires signing secrets. Signed APK generation/install/native tracking acceptance are still unverified.

### Supabase Shadow
- Migration ledger contains applied compatibility/repair entries and repeated direct-trip migration names. The live database is not safely reproducible by blindly replaying the repository migration folder into a fresh project.
- Read-only metadata checks confirm:
  - The dispatch finalizer functions are not executable by `anon` or `authenticated`.
  - Key office/driver RPCs are executable by authenticated users but not anon.
  - Direct table SELECT/INSERT/UPDATE/DELETE privileges are not granted to anon/authenticated for the reviewed operational tables (`bookings`, `actual_loading_records`, `dispatch_windows`, `driver_load_choices`, `notifications`, `office_notifications`, `waiting_list_entries`); RLS is enabled on these tables. The policy inventory returned zero policies for these tables, so direct client access appears intentionally closed and access is through guarded RPCs/service role. Confirm the complete intended access model before adding policies.
  - The one-minute dispatch scheduler is active; recent runs through 2026-10-16 06:13 UTC succeeded.
- The Supabase security advisor reports a number of `SECURITY DEFINER` RPCs callable by authenticated users and leaked-password protection disabled. SECURITY DEFINER is not inherently unsafe, but each function must enforce the intended role and office scope.
- The performance advisor reports 28 foreign keys without covering indexes and one unused index; these are optimization follow-ups.

## Release gates still open
1. Reconcile the full schema and migration history into a deterministic, uniquely versioned bootstrap for a separate fresh project.
2. Finish function-by-function authorization review of exposed `SECURITY DEFINER` RPCs and verify the exact role/office checks.
3. Build, install, and validate signed Android APKs against Shadow, including native driver tracking.
4. Run end-to-end acceptance with dedicated test identities and synthetic records only: direct assignment privacy/acceptance, queue eligibility/geofence, winner/loser outcomes, actual-weight notifications, delivery gate, reports, cancellation and redirect lifecycle.
5. After these gates pass, transfer the verified app and canonical schema to the intended isolated project.

## Decision
**CI passed for the audited commit; release and clean-project transfer remain blocked** by migration reconciliation, function-level authorization review, and Android/runtime acceptance. Keep Primary untouched and PR #63 Draft.