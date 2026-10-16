# Tiba Shadow RLS Event Trigger — Verified Remediation

Date: 2026-10-16
Target: `bvyxiahpxogblkmtjxyx` (Shadow only)

## Applied

Applied migration `phase1_revoke_public_rls_event_trigger_shadow_remediation` (version `20261016210023`) to revoke direct EXECUTE on `public.rls_auto_enable()` from `PUBLIC`, `anon`, and `authenticated`.

## Verified after migration

- `ensure_rls` event trigger exists and is enabled (`ddl_command_end`) for `CREATE TABLE`, `CREATE TABLE AS`, and `SELECT INTO`.
- Function privilege query: `anon_execute=false`, `authenticated_execute=false`, `public_execute=false`.
- Security advisor: no findings.
- Created a temporary probe table in Shadow; the trigger enabled RLS (`relrowsecurity=true`); probe table was dropped after the check.

## Scope and remaining work

- This remediation was applied only to Shadow project `bvyxiahpxogblkmtjxyx`.
- No production/operational project was changed.
- The clean v191 application schema and RPC contract reconciliation remain separate work; this remediation does not make Shadow ready for app testing by itself.
