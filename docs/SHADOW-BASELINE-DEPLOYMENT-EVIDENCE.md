# Shadow Baseline Deployment Evidence

Date: 2026-10-14
Branch: shadow/phase1-hardening

## Deployment
The clean Phase 1 baseline migration `20261014190000_phase1_clean_baseline.sql` was successfully applied to the Supabase project `Tiba-Supplies-Shadow` (project ref `awgppfjxegognuqozldl`). This did not target production.

## Verified after apply
- The `public` schema contains the 14 baseline tables declared by the migration.
- All 14 baseline tables have RLS enabled.
- No operational records were seeded.
- Exactly two office reference rows exist:
  - `MAIN` / `HEAD_OFFICE`, active, coordinates intentionally unset.
  - `RAS_SEDR` / `BRANCH`, active, latitude `29.556864`, longitude `32.761699`, radius `10000` metres.
- Office type is unique, so the schema permits at most one row per office type.
- The baseline revokes direct table privileges from `anon` and `authenticated`; client access must be added deliberately through reviewed RPCs/Edge Functions.

## Important current limitations
This is a database schema baseline, not a completed runnable application backend yet:
- No Main Office login/user has been provisioned.
- No role-aware RPC layer has been added.
- No driver location, geofence, queue, assignment, loading, or delivery RPCs have been deployed.
- No table-level client grants or RLS policies were added; direct client table access is intentionally closed.
- No tests have been run against application behavior.
- The migration is committed in GitHub and applied to Shadow, but the Supabase migration ledger may not mirror the repository migration file name automatically; verify ledger consistency before relying on CLI migration history.

## Next build sequence
1. Add and test role/identity helper functions.
2. Add narrowly scoped Main Office RPCs for master-data management and load-order lifecycle.
3. Add atomic direct assignment with conflict prevention and audit logging.
4. Add central geofence/location validation and driver-owned actions.
5. Add frontend integration and generated types from Shadow.
6. Execute acceptance tests and record actual results.

No production schema, production data, or production deployment was modified.
