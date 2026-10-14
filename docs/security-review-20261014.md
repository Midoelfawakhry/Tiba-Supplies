# Tiba-Supplies — Security Review & Patch Plan (2026-10-14)

## Change boundary

- Review branch: `security-review/20261014-draft`
- Base: repository `main` at branch creation.
- No merge, pull request merge, production SQL mutation, or data mutation was performed.
- This is a review artifact. Do not apply the draft SQL to production.

## Live Supabase evidence collected

Read-only inspection of project `tnlcvwtphbunteifoonc` on 2026-10-14:

- `public` contains **42 SECURITY DEFINER functions**.
- **37** are executable by `authenticated`; **0** are executable by `anon` in the inspected function ACLs.
- Supabase Security Advisor reports 32 public tables with RLS enabled and no direct policies. This is not automatically a defect in the current RPC-oriented access model; RPC authorization and table grants still require verification.
- The tested direct privileges query found no direct SELECT/INSERT/UPDATE/DELETE privileges for `anon` or `authenticated` on the tested public tables. A separate broader audit of TRUNCATE/REFERENCES/TRIGGER/MAINTAIN and default privileges is still required.
- Auth leaked-password protection is disabled according to the Security Advisor.

## Findings and proposed disposition

### P1 — Office identity is selected by “first active office”

Live definitions of `get_driver_portal_snapshot()` and `get_office_waiting_list()` select an active BRANCH office using ordering plus `LIMIT 1`. The repository's current migration history also documents a similar assumption in direct-assignment/cancellation flows.

**Risk:** if a second active BRANCH office is introduced, driver geofence, queue, dispatch, or cancellation can resolve a different office from the one associated with the load or driver.

**Patch direction:** use persisted office identity from the driver's active `driver_office_assignments` row or the load's `check_in_office_id`; never infer the office from alphabetical/creation ordering. For flows that truly support only one branch, first verify the live count and data model, then enforce that invariant with a partial unique index only after the preflight is clean. Do not add a unique index blindly.

### P1 — Branch directory is broader than branch-specific operational records

The reviewed repository definition of `get_branch_office_snapshot()` filters loads, actuals, allocations, and waiting entries by the branch office, but its `directory` subquery selects every active driver. This may disclose contact and vehicle-owner information for drivers outside the branch's assigned scope.

**Patch direction:** define the intended directory semantics explicitly. If it is a branch-wide contact directory, return only drivers whose active `driver_office_assignments` row points to the authenticated user's `office_id`; if drivers are intentionally shared globally, document that business rule and minimize exposed phone/owner fields. Preserve the authenticated user's branch office from `app_users.office_id` as the scope source.

### P1 — Migration history does not reconcile cleanly

The repository's existing `docs/phase1-migration-reconciliation.md` records production ledger entries without exact matching migration files, and repository migrations with versions absent from the live ledger. It explicitly warns against fabricating historical migrations or replaying files based on filename alone.

**Patch direction:** compare live function definitions and the production migration ledger against each candidate file; do not replay or rename historical migrations as part of this security patch. Add a uniquely versioned forward migration only after a clean staging replay and semantic reconciliation.

### P1 — SECURITY DEFINER role/ownership and search-path review

The Advisor reports 37 authenticated-callable SECURITY DEFINER functions. That warning alone does not mean all 37 are vulnerabilities. Some are intended authenticated RPCs; trigger helpers and internal functions should not be directly callable.

**Patch direction:** review every signature for:
1. explicit `auth.uid()` requirement where applicable;
2. active user and role check before reads/writes;
3. ownership/scope checks on supplied IDs;
4. fixed, safe `search_path` (prefer `pg_catalog, public` where compatible and fully qualify application objects);
5. least-privilege EXECUTE ACLs;
6. audit logging for sensitive mutations;
7. concurrency-safe uniqueness enforced at database level.

Do not globally revoke authenticated execution without preserving the intended RPC surface.

### P2 — Operational mutation and reporting endpoints

Prioritize direct assignment/acceptance, dispatch, cancellation, redirect, delivery confirmation, driver/vehicle create/update, live location, account statements, and vehicle-owner reports. Verify that BRANCH users cannot invoke write RPCs directly and that each report has a documented role and data scope.

### P2 — Leaked-password protection

Enable Supabase Auth leaked-password protection after confirming the app's password UX and supported auth configuration. This is an Auth setting change, not a SQL migration.

## Acceptance tests required before applying any patch

- Unauthenticated `anon` calls are denied for all operational RPCs.
- BRANCH cannot invoke main-office write RPCs directly even if UI controls are bypassed.
- A branch snapshot contains no out-of-scope directory entries under the chosen directory policy.
- Driver sees available loads only for the persisted check-in office and only when fresh GPS is inside its geofence.
- Missing, stale, future-dated, inaccurate, and out-of-radius location samples fail closed.
- Direct assignment stays pending until the intended driver accepts; duplicate acceptance does not create a second actual-loading row.
- Concurrent dispatch does not exceed requested quantity or assign one driver/vehicle twice.
- Cancellation and redirect preserve queue office identity and audit history.
- Delivery cannot be confirmed twice and must be owned by the authenticated driver.
- Account statements and owner reports enforce role/date boundaries.
- Clean staging bootstrap and Android branch/driver smoke tests pass.

## Current status

**Review in progress — do not deploy.** The findings above are based on read-only inspection and repository evidence. Remaining work is to finish the full per-function review, reconcile live-vs-repository definitions, write explicit reviewed function replacements, and run tests against isolated staging. Production remains unchanged.
