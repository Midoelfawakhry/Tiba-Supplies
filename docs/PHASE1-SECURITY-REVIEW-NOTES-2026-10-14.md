# Phase 1 Security Review Notes — 2026-10-14

Scope reviewed: selected migration and Edge Function source files on `shadow/phase1-hardening`. This is a static source review, not a penetration test.

## Positive controls observed
- `create-driver-account` validates the caller token with Supabase Auth, checks an active application profile, and limits account-management roles to ADMIN and HEAD_OFFICE.
- `create-branch-employee` validates the caller token and active profile; its source includes an explicit role check and a fail-closed marker for the expected single active branch office.
- `20261011133500_enforce_single_active_branch_office.sql` uses a partial unique index to enforce at most one active BRANCH office at the database level.
- `20261012180000_enable_counter_rls.sql` enables RLS and revokes direct client privileges on counter tables instead of adding client-facing policies.

## Items requiring verification before release
1. **RPC role gates:** inspect every overload, not just each function name. Verify the exact function signature, grants, owner, SECURITY DEFINER mode, and search_path. Dynamic function replacement migrations need to fail closed when any expected overload is absent.
2. **Active head office invariant:** the branch-office unique index enforces at most one active BRANCH office, but it does not enforce exactly one active HEAD office. RPCs should reject zero or multiple active head offices rather than selecting an arbitrary first row.
3. **RLS and grants:** confirm the full set of policies and privileges in the canonical export. RLS enabled without policies can be intentional when clients have no table grants and access is mediated by reviewed RPCs; it must not be “fixed” by broad policies.
4. **Edge Function deployment:** verify branch-specific deployment workflows target only the Shadow project and cannot publish the Shadow branch to production. Keep service-role keys in environment secrets; never commit values.
5. **CORS:** wildcard CORS is not itself authorization, but browser origin restrictions should be tightened where operationally practical. Bearer-token and role checks must remain mandatory.
6. **Driver location:** enforce authenticated driver identity, timestamp freshness, and geofence checks server-side. Do not trust coordinates or driver IDs supplied only by the client.

## Acceptance tests to run against Shadow
- Anonymous and expired-token requests are rejected.
- BRANCH cannot create driver accounts, create additional branch accounts, create load orders, dispatch, cancel, redirect, or modify master directory records.
- HEAD_OFFICE can perform permitted operational writes but cannot bypass active-entity or duplicate guards.
- DRIVER can access only its linked active driver profile, eligible load offers, and its own permitted location/confirmation paths.
- Zero or multiple active HEAD offices fail closed; zero or multiple active BRANCH offices fail closed.
- Duplicate active driver phone, vehicle code, trip code, booking acceptance and delivery confirmation are rejected by database constraints or transactional guards.
- Direct table access is denied where the application expects RPC-only access.
- No test requires real production records or credentials.

## Limitations
The production migration history is not reconciled with repository files, and Shadow is still empty. These notes do not claim the policies, grants, or deployed behavior have been exhaustively verified. No production or Shadow DDL was changed in this review.
