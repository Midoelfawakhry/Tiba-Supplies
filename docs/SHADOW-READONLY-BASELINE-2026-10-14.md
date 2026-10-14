# Shadow Phase 1 — Read-only Baseline Inventory

**Captured:** 2026-10-14  
**Target repository:** `Midoelfawakhry/Tiba-Supplies`  
**Branch:** `shadow/phase1-hardening`  
**Production Supabase project:** `tnlcvwtphbunteifoonc`  
**Mode:** READ-ONLY. No production SQL, schema, auth, storage, function, or app configuration was changed by this inventory.

## 1. Environment status

- GitHub Shadow branch exists.
- Supabase project is ACTIVE_HEALTHY.
- Current Supabase branch listing contains only the default `main` branch; no isolated development branch was found.
- The repository's Shadow plan correctly blocks SQL mutations and end-to-end tests until a separate staging database is available.
- The production project has migration records, but repository migration-source reconciliation remains an open task.

## 2. Database migration ledger

The Supabase migration ledger currently reports 38 migrations, from `20261010182259` through `20261014143544`. Recent entries include driver history/geofence separation and native driver tracking sessions. This ledger is a production reference only; it must not be treated as proof that matching migration files exist in Git.

**Next verification:** compare every ledger version/name against repository migration files and inspect missing or renamed sources without recreating history from memory.

## 3. Security Advisor baseline

The Supabase Security Advisor reported these items at capture time:

- **32 tables** with RLS enabled but no policies detected by the linter.
- **37 SECURITY DEFINER function findings** callable by the `authenticated` role.
- These are audit findings, not automatically confirmed vulnerabilities. RLS-enabled tables with no policies can intentionally deny client access, and exposed SECURITY DEFINER RPCs may be intentional when they enforce identity, role, office scope, fixed search_path, and suitable execute grants.

**Required action:** review each table and exact function signature against intended app behavior, ownership checks, caller roles, execute ACLs, office/branch boundaries, and dependencies. Do not apply blanket grants/revokes.

Security Advisor reference:
- RLS without policies: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Authenticated SECURITY DEFINER execution: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## 4. Function inventory observations

A read-only catalog query found public SECURITY DEFINER functions, including overloads for `create_operational_driver`, `create_operational_vehicle`, and several load dispatch, acceptance, location, account-statement, and branch snapshot functions.

Notable review items:
- Several functions report `search_path=public`; some report an empty per-function setting. Review each function body and its caller/dependency graph before changing it.
- Function signatures must be audited individually; overloaded names are separate authorization surfaces.
- Do not change production execute grants or function definitions during this phase.

## 5. Edge Function deployment metadata

The production project lists four active functions:
- `create-driver-account` — version 13, `verify_jwt=false`
- `create-branch-employee` — version 3, `verify_jwt=true`
- `tiba-ai-assistant` — version 7, `verify_jwt=true`
- `driver-native-location` — version 1, `verify_jwt=false`

A false platform JWT-verification setting is a review flag, not a standalone vulnerability verdict. Inspect the function's own authentication/authorization checks before proposing changes. Do not redeploy production functions from Shadow.

## 6. Performance Advisor

The Performance Advisor reported foreign-key indexes that may be missing and two tables without primary keys, among other informational findings. Treat each as a candidate for review; do not add indexes or primary keys to production without checking workload, data integrity, and migration safety.

## 7. Next safe execution steps

1. Obtain approval for the hourly cost of a Supabase development branch before creating it.
2. Create a separate staging database branch only after cost approval; do not copy production data into tests.
3. Reconcile repository migration files with the read-only production ledger.
4. Generate synthetic fixtures in staging and test authorization, office scope, geofence freshness/radius, assignment acceptance, dispatch concurrency, delivery idempotency, and cancellation/redirect behavior.
5. Review the security findings function-by-function; make candidate changes only in Shadow/staging.
6. Keep Office, Driver, and Ras Sedr Branch APK release pipelines separate and do not replace currently tested signed APKs.

## Safety statement

This document records observations and next steps only. It does not claim that the full app has been tested, that the flagged findings are confirmed vulnerabilities, or that Shadow is isolated from production yet.
