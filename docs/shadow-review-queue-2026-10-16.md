# Shadow Review Queue — 2026-10-16

## Scope
Read-only review of outstanding application PRs and GitHub Actions. No PR was merged,
no migration was applied, and no production or Shadow database was changed by this review.

## PR #72 — owner creation and multiple driver-to-vehicle assignments
- PR: https://github.com/Midoelfawakhry/Tiba-Supplies/pull/72
- Head: `afc9eec4ea34f496dbffb67d3699981615ed17f3`
- Observed GitHub Actions at this head:
  - Migration integrity: SUCCESS (run 38773093936)
    - unique 14-digit migration versions: passed
    - branch snapshot scope: passed
  - Phase 1 build: SUCCESS (run 38773094006)
    - TypeScript/lint: passed
    - Phase 1 authorization tests: passed
    - web build: passed
    - SQL regression suite on disposable PostgreSQL: passed
- These results support the branch's static/CI checks only. They do not prove the migration
  was applied to a live database, validate real account workflows, or replace Windows app
  and operational acceptance tests.
- Required before merge/release: validate owner creation without a vehicle; attach a vehicle;
  assign two drivers to one vehicle; verify check-in, dispatch, active booking constraints,
  and historical assignment behavior. Confirm the business rule for whether multiple drivers
  may be assigned to a vehicle while only one trip can be active for that vehicle.

## PR #62 — native background driver location
- PR: https://github.com/Midoelfawakhry/Tiba-Supplies/pull/62
- Head: `5708792bd129a3bb3bf35c8a1094816273df06f1`
- No workflow runs were returned for this exact head during this review; do not claim CI passed.
- Migration `supabase/migrations/20261014_native_driver_tracking_sessions.sql` exists on the
  feature branch. It creates scoped, expiring tracking sessions with hashed tokens and denies
  direct client table access.
- Still required: confirm CI on the current PR head; review the Edge Function authorization,
  token expiry/revocation and active vehicle-assignment checks; deploy only to the approved
  non-production environment; and test swipe-away/background upload, logout, token expiry,
  and permission denial on the target Android device. No physical-device result is established.

## Clean-bootstrap blocker remains
The core schema creation source is still not established. The migration
`20261009_phase1_live_core.sql` defines a snapshot function rather than the base tables.
Do not treat a passing disposable test for an individual migration as proof that the complete
application can bootstrap from an empty database.

## Next safe steps
1. Recover the missing core schema and three historical migration sources, or propose a clearly
   labeled reconstruction based on a read-only schema comparison.
2. Resolve PR #72's multiple-driver/one-vehicle operational acceptance cases.
3. Recheck CI for PR #62 and run device tests before approval.
4. Keep production untouched; do not merge or deploy based only on this review.
