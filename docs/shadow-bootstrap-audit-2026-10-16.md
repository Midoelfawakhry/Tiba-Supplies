# Shadow Bootstrap Audit — 2026-10-16

## Scope and safety

This is a read-only inventory of the dedicated Supabase Shadow project `bvyxiahpxogblkmtjxyx` and the repository's `shadow/phase1-hardening` branch. No SQL migration, operational data write, production change, or merge to `main` was performed during this audit.

## Observed Shadow database state

- Supabase project status: `ACTIVE_HEALTHY`, region `eu-west-1`.
- Application schema `public`: no application tables found.
- Supabase migration ledger: empty.
- Edge Functions: none listed in the Shadow project.
- Installed extensions include `pgcrypto`, `uuid-ossp`, `plpgsql`, `pg_stat_statements`, and `supabase_vault`.
- Supabase Security Advisor reported two warnings for `public.rls_auto_enable()`: SECURITY DEFINER function executable by `anon` and `authenticated`. Read-only catalog inspection confirmed it is owned by `postgres`, is bound to the `ensure_rls` event trigger on `ddl_command_end`, and has no explicit ACL (PostgreSQL default function execute privileges apply). Its body enables RLS on newly created public tables. This is database bootstrap infrastructure, not a normal application RPC; do not alter it based on the advisor warning alone. Confirm the platform's intended default before changing grants.

The absence of app tables and migration records means the Shadow database is not yet initialized with Tiba-Supplies' application schema. Do not seed operational records or apply isolated hardening migrations before a clean bootstrap is reviewed.

## Repository source-of-truth

The branch README defines the required workflow:
1. Main Office drafts and publishes a load order for an active factory and quarry.
2. Driver eligibility is enforced server-side using active account, current driver/vehicle assignment, GPS freshness/accuracy, and the configured Ras Sedr geofence.
3. Direct assignment links an order to an eligible driver and currently assigned active vehicle.
4. Actual loading/progress must be tied to the booking/order relationship and must not be inferred from factory/quarry matches alone.
5. Arrival/delivery uses driver-owned server RPCs, fresh accurate location, and duplicate-delivery protection.
6. Branch Office is read-only and office-scoped.
7. Vehicle owners remain separate from drivers/vehicles, with driver-vehicle assignment history.

The migration reconciliation document identifies 11 non-standard legacy migration filenames and three production-history versions without exact local SQL source files. It explicitly requires source recovery, dependency review, and a validated clean-database bootstrap before rearranging or replaying the legacy set.

## Next safe steps

1. Recover the complete migration filename inventory from the branch and inspect the initial schema migrations in dependency order.
2. Build a clean-bootstrap manifest that distinguishes foundational schema, incremental migrations, and candidate hardening migrations.
3. Recover the three missing historical SQL sources from reachable refs/history; do not fabricate originals or replay them under their historical version identifiers.
4. Run existing PostgreSQL regression scripts only against disposable local/CI PostgreSQL, then extend them to cover clean bootstrap and transactional authorization/acceptance cases.
5. Initialize the dedicated Shadow database only after the complete ordered migration set is verified and can be applied as a coherent baseline.
6. Run authenticated Shadow RPC workflow tests and app CI. Keep Android device/background-GPS tests as a separate release gate.
7. Keep production untouched and do not merge `shadow/phase1-hardening` to `main` without explicit release approval.

## Current disposition

**Shadow bootstrap: NOT READY.** The project is healthy but its application schema is empty, the migration ledger is empty, and the repository's documented legacy migration gaps prevent a safe blind replay. The next implementation step is source inventory and bootstrap validation, not ad-hoc SQL.
