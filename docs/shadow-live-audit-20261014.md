# Shadow Phase 1 — Live Database Audit (2026-10-14)

**Scope:** read-only inspection of the connected production Supabase project.  
**Target branch for remediation:** `shadow/phase1-hardening`.  
**Production writes:** none performed.  
**Confidence labels:** CONFIRMED means visible in the current live function definition/catalog output; REQUIRES REVIEW means the impact depends on intended business rules or dependencies.

## Confirmed findings

### P1 — Office identity is selected by name/order rather than persisted assignment
**Functions confirmed:** `get_driver_portal_snapshot()`, `get_office_waiting_list()`, `get_phase1_snapshot()`, `direct_assign_standalone_load(...)`, and `get_branch_office_snapshot()` all select an active office using `ORDER BY ... LIMIT 1` rather than requiring a unique configured office or resolving the office from the relevant persisted relationship.

**Impact:** if a second active BRANCH or HEAD office is introduced, the driver geofence, waiting list, direct assignment, or office snapshot may silently use the wrong office. The code currently fails only when no qualifying office is found, not when there are multiple candidates.

**Shadow correction:** centralize office resolution and fail closed when the expected office is ambiguous; for branch-scoped workflows resolve the office from the authenticated branch account or driver's active office assignment, and for loads use the persisted `check_in_office_id`. Keep HEAD operational ownership distinct from BRANCH check-in/geofence scope.

### P1 — Direct-assignment path does use pending acceptance, but office binding is ambiguous
**Function confirmed:** `direct_assign_standalone_load(uuid, uuid, uuid)` inserts a `BOOKED` booking and a `standalone_direct_load_audit` row. The returned definition indicates the flow can remain pending until driver acceptance; do not redesign that behavior without tracing `accept_direct_assignment` and the app UI.

**Impact:** it geofences against the first active BRANCH office, while the audit row's `office_id` stores the selected HEAD office in the current definition. The audit row does not appear to persist the branch/geofence office separately. This can make future cancellation, redirection, queue re-entry, or multi-branch reporting ambiguous.

**Shadow correction:** preserve the pending acceptance contract; explicitly persist both operational HEAD office and check-in/geofence BRANCH office (or persist a dedicated branch ID) and validate both on acceptance/cancel/requeue. Design schema migration only after checking all consumers and data migration behavior.

### P1 — Branch snapshot includes high-sensitivity fields; verify directory scoping
**Function confirmed:** `get_branch_office_snapshot()` returns phone numbers for drivers, owners, and vehicle-related rows in branch-scoped actual-loading/allocation results. The definition also selects the first active HEAD office for its snapshot. The directory query is beyond the truncated excerpt and must be reviewed in full before a final scope claim.

**Shadow correction:** inspect the complete function and branch UI requirements. Default to least data necessary and branch-scoped driver/vehicle directory unless a documented cross-branch business rule requires global visibility. Do not remove fields needed for legitimate operations without mapping the UI.

### P1 — Phase 1 snapshot is role-gated but globally returns active directory records
**Function confirmed:** `get_phase1_snapshot()` rejects roles outside ADMIN/HEAD_OFFICE. It returns all active factories, quarries, drivers, and vehicles, while operational load orders/bookings/loading records are scoped to the first active HEAD office.

**Impact:** current role gate protects BRANCH from this RPC, but multiple active HEAD offices can cause an inconsistent operational snapshot; active driver/vehicle directories are global by design in this function and should be confirmed against the office model.

**Shadow correction:** enforce a unique configured operational HEAD office or make the office context explicit; document whether master directories are intentionally global. Do not change global directory behavior without confirming the data model.

### P1 — SECURITY DEFINER function inventory includes empty search_path settings
The live catalog inventory reports 42 public SECURITY DEFINER functions, with 37 executable by `authenticated` and 0 executable by `anon`. Three functions have an explicitly empty search_path setting: `get_driver_edit_options(uuid)`, `get_vehicle_owner_directory()`, `update_operational_driver(uuid,text,text,text,uuid)`, and `update_operational_vehicle(uuid,text,text,uuid,text,text)` (four functions; the first inventory summary needs to be read by exact signature, not by an assumed count).

An empty search_path can be an intentional hardening technique **only if all object references are schema-qualified**. Review each full body before changing it. Most other functions set `search_path=public`, which is safer than an implicit path but still deserves a hardened path and qualified references review for privileged functions.

**Shadow correction:** create an exact-signature function register with auth/role checks, caller intent, search_path, execute ACL, data returned, and writes performed. Do not revoke EXECUTE from all authenticated functions wholesale: intended app RPCs require it. Remove execute access only from internal trigger/helper functions after dependency review.

### P2 — Security Advisor flags leaked-password protection as disabled
The live Security Advisor returned `auth_leaked_password_protection` at WARN level. This is an Auth project setting, not an application SQL patch. Enable and test it in the isolated staging project first, then document the production setting change separately for an approved release.

## Current verified facts

- The connected Supabase project `tnlcvwtphbunteifoonc` is the existing `Tiba-Supplies` project and was inspected read-only.
- `offices` has RLS enabled; the inspected schema includes HEAD/BRANCH office types, app-user office IDs, driver office assignments, load operational office IDs, and load check-in office IDs.
- `get_driver_portal_snapshot()` retains `my_bookings` independently of geofence and only populates `available_loads` when the latest location is fresh and inside the selected branch geofence. This is the intended historical-visibility behavior and should be preserved.
- `get_office_waiting_list()` is restricted in its body to ADMIN/HEAD_OFFICE, but its office selection is ambiguous if multiple active branches exist.
- `direct_assign_standalone_load()` requires ADMIN/HEAD_OFFICE, checks location freshness and geofence, and blocks a driver/vehicle with an active booking; it still uses the first active branch as the geofence.
- The current Security Advisor reports leaked-password protection disabled. Additional SECURITY DEFINER findings are informational until each function's body, role guard, ACL, and purpose are assessed.

## Implementation order in Shadow

1. Finish exact function/ACL inventory and trace the full branch snapshot, accept/cancel/redirect, driver-location, and directory RPC definitions.
2. Define office cardinality and assignment invariants in tests before changing SQL.
3. Build isolated staging database and test fixtures; no production fixtures or fake production loading data.
4. Implement forward-only migration drafts in `supabase/review/`, with explicit function signatures and grants.
5. Add SQL assertions for role boundaries, office scope, stale GPS, pending acceptance, idempotent delivery, and concurrent capacity.
6. Run web lint/build and three Android app-variant smoke tests.
7. Record every pass/fail and only then prepare a release candidate.

## Not yet proven

- Staging Supabase has not been provisioned or isolated yet.
- No function patch from this review has been applied to production.
- The full 42-function review, staging E2E, and Android device matrix are not complete.
- This audit is not a release approval.
