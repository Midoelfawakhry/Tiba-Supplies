# Tiba Shadow CI Evidence — 2026-10-17

## Scope and exact commits checked

Branch: `shadow/phase1-hardening`

Current branch tip observed from GitHub Actions:
- Commit: `7e96394cb18a303258a29e9a7f79cfdb9611bd61`
- Commit title: `docs: expand v191 bootstrap gate with canonical schema blockers`

Two workflows completed successfully on this exact commit on 2026-10-16:
- [Phase 1 build — run 38974294299](https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38974294299)
- [Phase 1 Shadow CI — run 38974294393](https://github.com/Midoelfawakhry/Tiba-Supplies/actions/runs/38974294393)

## What passed

### Phase 1 build
- `npm install`
- `npm run lint`
- `npm run test:phase1`
- `npm run build`
- PostgreSQL regression checks for table privilege restrictions, master-directory write controls, driver/vehicle picker authorization, internal counter RLS, and trigger-only driver office assignment

All steps reported `success`.

### Phase 1 Shadow CI
- `npm run test:phase1`
- TypeScript/lint check
- Production frontend build
- Disposable PostgreSQL 16: clean baseline smoke test
- Disposable PostgreSQL 16: versioned v191 schema/RPC chain replay, excluding optional `20261015186000_phase1_queue_scheduler.sql`
- Assertions that the expected v191 RPC names and queue/assignment objects exist, and that the two assignment relation names are not both present

All three jobs reported `success`.

## What this does and does not prove

**Proven:** the configured GitHub Actions jobs passed on the recorded branch commit, including the specific disposable PostgreSQL replay implemented by `.github/workflows/phase1-shadow-ci.yml`.

**Not proven by these jobs:**
1. The standalone `supabase/tests/phase1_v191_contract_gate.sql` was not invoked by the workflow steps inspected. Therefore its named-argument checks for the eight-argument `driver_confirm_delivery`, `driver_confirm_arrival`, and `driver_select_load` are not proven by this CI run.
2. The replay script selects migration files matching a numeric-prefix pattern at or after the clean baseline, and excludes the optional scheduler. It does not replay the non-standard legacy filenames. This is a defined CI chain, not proof that every historical migration file can be replayed from zero.
3. Existence of RPC names does not prove correct return JSON keys, role checks, office scope, geofence freshness, authorization behavior, concurrency safety, or end-to-end v191 driver workflow.
4. It does not prove the live Supabase Shadow project has been initialized or matches the disposable database.
5. It does not prove on-device GPS, native tracking, signed Android APK behavior, or production deployment safety.

## Required next gate

1. Extend CI to execute `supabase/tests/phase1_v191_contract_gate.sql` against the same disposable database after the versioned replay.
2. Add authenticated contract tests for all nine required driver RPCs, including accepted/rejected responses and exact error identifiers.
3. Compare the resulting schema/functions/triggers/grants against the reviewed Production inventory and document intentional differences.
4. Only after these pass, prepare the dedicated Shadow project migration plan. Do not apply to Production, merge to `main`, or change the working v191 AI assistant/native tracking behavior as part of this schema task.

## Safety statement

This document records CI evidence only. No SQL was applied to either live Supabase project by this review.
