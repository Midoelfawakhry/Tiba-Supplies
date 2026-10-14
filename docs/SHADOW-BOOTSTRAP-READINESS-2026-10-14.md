# Shadow Bootstrap Readiness Gate — 2026-10-14

## Current verified state
- Shadow Supabase project: `Tiba-Supplies-Shadow`, ref `awgppfjxegognuqozldl`, region `eu-west-1`.
- Shadow public schema currently has no tables.
- Shadow migration ledger is empty.
- Existing app branch: `shadow/phase1-hardening`.
- A generated TypeScript database type snapshot from production was added at `src/types/database.types.ts` (commit `6f0516b1c0b4b5cd69cf1e5b8a9a442cac6c4579`). This is a reference snapshot, not a migration or proof of equivalence.
- Existing migrations directory has 48 SQL files; the list contains several date-only prefixes and mixed timestamp conventions. This is not safe to replay wholesale as a fresh baseline.

## Do not apply yet
A schema bootstrap cannot be responsibly generated from TypeScript types alone. Types do not encode all exact SQL details: RLS policies, grants, function bodies, trigger definitions, partial/functional indexes, extensions, storage policies, and Auth configuration.

## Required source artifacts
1. Schema-only export of production excluding row data and secrets, or exact DDL extracted for:
   - tables, columns, identity/defaults, enums, domains, sequences
   - primary/unique/foreign/check constraints and indexes
   - views and materialized views
   - functions and procedures with exact signatures, bodies, owner, security mode, search_path and grants
   - triggers
   - RLS enable/force flags, policies, table/sequence grants, default privileges
   - required extensions
   - Storage buckets and policies (metadata only; no file contents)
2. Reconciliation mapping each migration ledger version to its exact SQL source and checksum.
3. Edge Function source/config review, including environment variable names but not secret values.

## Phase 1 implementation sequence
A. Capture schema-only artifacts and store reviewed snapshots in the shadow branch.
B. Create a uniquely versioned, fresh-install baseline under a separate reviewed path; do not rename/rewrite already-applied historical migrations.
C. Create a deterministic local reset/replay procedure and CI checks for unique version IDs and migration ordering.
D. Deploy baseline only to the isolated Shadow project.
E. Apply later migrations in order, checking each precondition and postcondition.
F. Add explicit least-privilege RLS policies and function EXECUTE grants based on role matrix; test anon, HEAD_OFFICE, BRANCH, DRIVER, and owner use cases.
G. Deploy Edge Functions to Shadow with newly created test users and newly configured secrets.
H. Run typecheck, build, authorization tests, and operational workflow tests; capture logs/results.

## Business workflow acceptance cases
- One active head office and explicit branch-office identity; zero or multiple matches fail closed.
- Drivers see only eligible loads within the configured office/geofence and location freshness window.
- Load creation does not silently assign a driver/vehicle.
- Direct assignment stays pending until driver acceptance.
- No duplicate trip code, active driver/vehicle assignment, acceptance, delivery confirmation, or queue re-entry.
- Actual loading record preserves the source ticket, date, vehicle, driver, quarry, factory, weight and audit trail.
- Branch read access is scoped and cannot perform head-office writes.
- Vehicle owner management remains separate from driver management.
- Location history is only visible to explicitly authorized roles.

## Exit criteria
- Fresh reset succeeds from an empty database.
- Shadow schema matches reviewed canonical schema.
- Security and authorization tests pass.
- App build and lint pass.
- No production credentials or production records are used.
- No changes have been made to production as part of this checklist.
