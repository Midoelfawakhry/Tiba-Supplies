# Tiba Shadow Security Check — 2026-10-16

Target: `bvyxiahpxogblkmtjxyx` (isolated Shadow project)
Method: read-only Supabase advisor scan and catalog query. No changes made.

## Results

- Public schema tables: none reported by the table inventory.
- Migration ledger: empty.
- Performance advisor: no findings.
- Security advisor: two warnings for the same function, `public.rls_auto_enable()`:
  - callable by `anon`
  - callable by `authenticated`
  - declared `SECURITY DEFINER`
  - function setting includes `search_path=pg_catalog`

The catalog definition indicates this is an event-trigger function intended to enable RLS when tables are created in `public`. The advisor reports it as callable through the exposed RPC surface, so its grants should be reviewed. Do not assume the function is safe to expose just because it is an event-trigger function.

## Recommended remediation

Before the first schema migration on Shadow:
1. Confirm whether `rls_auto_enable()` is attached to an event trigger and inspect that trigger's enabled state.
2. Revoke direct execution from `PUBLIC`, `anon`, and `authenticated` if no direct API execution is required; preserve the event-trigger execution path.
3. Re-run the security advisor and verify the trigger still enables RLS on newly created public tables.
4. Include the fix in the clean bootstrap migration/history so future environments are reproducible.

## Guardrails

- This was a read-only check; no grants, triggers, tables, migrations, or data were changed.
- No production/operational project was queried or modified as part of this check.
- Do not apply the full legacy migration directory to Shadow. Reconcile it against the v191 client contract first.
