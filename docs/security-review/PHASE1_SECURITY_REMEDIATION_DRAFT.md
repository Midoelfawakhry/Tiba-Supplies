# Tiba-Supplies — Phase 1 Security Remediation Draft

**Status:** Draft only — NOT applied to Supabase, NOT merged into `main`, and NOT a production migration.
**Review date:** 2026-10-14
**Supabase project:** `tnlcvwtphbunteifoonc`
**Repository base:** `main` at `005e21bce866c35a0ad662c7b836fb12a6ffface`
**Working branch:** `security-review/phase1-remediation-draft`

## Scope and guardrails

This draft targets the first confirmed authorization/data-scope issues. It intentionally does not issue grants/revokes or enable policies blindly. The security advisor reports 32 public tables with RLS enabled and no policies; a separate privilege query found no direct table privileges for `anon` or `authenticated` on the queried public base tables. Those facts must be considered together before changing policies.

Catalog inventory: 42 public `SECURITY DEFINER` functions total; 37 are executable by `authenticated`; 0 were executable by `anon` in the inspected privilege snapshot; 3 are trigger-returning functions and were not directly executable by those roles.

## P1 — Bind driver portal to the driver's assigned office

### Finding
`get_driver_portal_snapshot()` selects the first active BRANCH office ordered by name, rather than the active office assigned to the authenticated driver. It then uses that office for geofence distance, queue position, and available loads.

### Intended change
Resolve the driver's active office from `driver_office_assignments` using:
- `driver_id = v_driver_id`
- `assigned_to IS NULL`
- `assigned_from <= now()`
- join to an active office of type `BRANCH`
- deterministic newest assignment first

If no valid assignment exists, return an explicit configuration error or a safe empty portal state. Do not silently fall back to another branch.

### SQL logic to use inside the function after resolving `v_driver_id`
```sql
SELECT o.*
INTO v_office
FROM public.driver_office_assignments doa
JOIN public.offices o ON o.office_id = doa.office_id
WHERE doa.driver_id = v_driver_id
  AND doa.assigned_to IS NULL
  AND doa.assigned_from <= now()
  AND o.office_type = 'BRANCH'
  AND o.is_active = true
ORDER BY doa.assigned_from DESC, doa.created_at DESC
LIMIT 1;

IF v_office.office_id IS NULL THEN
  RAISE EXCEPTION 'ACTIVE_DRIVER_OFFICE_ASSIGNMENT_REQUIRED';
END IF;
```

**Implementation note:** This snippet is a replacement for the current `SELECT * INTO v_office FROM public.offices WHERE office_type='BRANCH'...` block, not a standalone SQL command. Before incorporating it into a full `CREATE OR REPLACE FUNCTION`, verify how driver office assignments are created and whether a driver can intentionally be assigned to multiple branches.

## P1 — Scope branch directory data

### Finding
`get_branch_office_snapshot()` correctly scopes load orders, loading records, allocations, and waiting-list entries to the branch office. However, the `directory` JSON block selects all active drivers and their assigned vehicles/owners without filtering by the branch's active driver-office assignment.

### Intended change
Replace the directory subquery's broad filter `WHERE d.is_active = true` with an office assignment predicate:

```sql
WHERE d.is_active = true
  AND EXISTS (
    SELECT 1
    FROM public.driver_office_assignments doa
    WHERE doa.driver_id = d.driver_id
      AND doa.office_id = v_branch_office_id
      AND doa.assigned_to IS NULL
      AND doa.assigned_from <= now()
  )
```

The final implementation must also decide whether the branch should see a driver with multiple active office assignments. If yes, the `EXISTS` predicate is appropriate; it avoids duplicate directory rows. Keep owner phone visibility only if required by the branch's operational workflow.

## P1 — Stop choosing a branch implicitly when creating load orders

### Finding
`create_load_order(...)` picks the first active BRANCH office with `LIMIT 1` and stores it as `check_in_office_id`. That becomes ambiguous when multiple branches are active.

### Intended change
For Phase 1, make the check-in office an explicit, validated configuration. Preferred durable design: add an explicit `p_check_in_office_id uuid` parameter and validate that the target office is active and `office_type='BRANCH'`; or use a single authoritative office-configuration relation if the product is intentionally single-branch. Do not infer the intended branch by sorting names.

**Compatibility warning:** Adding a function parameter changes the RPC signature and requires coordinated app/client updates. If retaining the existing signature for backward compatibility, the fallback must explicitly assert that exactly one active BRANCH office exists and fail closed otherwise.

## P1 — Direct assignment must use the intended office's geofence

### Finding
`direct_assign_standalone_load(...)` similarly selects the first active BRANCH office and checks the driver's location against that geofence.

### Intended change
Use an explicit office identifier supplied by the authenticated office workflow, or a single authoritative configuration relation. Validate that the caller is authorized for that office, and use the same office ID consistently for geofence validation and `standalone_direct_load_audit.office_id`. Do not simply pick the alphabetically first branch.

**Compatibility warning:** This requires confirming how the current UI selects an office and whether branch staff are meant to make direct assignments. Current function permits only ADMIN/HEAD_OFFICE, so do not broaden roles as part of this fix.

## P2 — Normalize driver uniqueness and concurrency

### Findings
The two overloads of `create_operational_driver` have inconsistent duplicate checks: one checks duplicates across all drivers, while the other limits checks to active drivers. Application-level `IF EXISTS` checks alone can race under concurrent inserts.

### Intended change
1. Decide and document whether phone and driver code must be unique across all records or only active records.
2. Normalize phone values consistently before comparison.
3. Add appropriate unique indexes/constraints only after querying existing duplicates and deciding how inactive historical records should behave.
4. Make both overloads follow the same rules.
5. Confirm that vehicle assignment constraints prevent concurrent active assignments to the same driver or vehicle.

No index or constraint is included in this draft because existing duplicates and the desired inactive-record policy must be checked first.

## P2 — Search path hardening

Some functions set `search_path = public`, while others set an empty path or `pg_catalog, public`. The functions inspected use schema-qualified references such as `public.drivers`, which is good. For consistency, set a safe fixed search path on each SECURITY DEFINER function and schema-qualify every non-built-in object; do not change a function's search path without reviewing its full body.

## Acceptance tests required before any production migration

- Unauthenticated request cannot execute protected RPCs.
- Driver A assigned to Branch A sees Branch A geofence, waiting queue, and available loads only.
- Driver assigned to Branch B cannot see Branch A's available loads or queue.
- Branch A directory does not include drivers assigned only to Branch B.
- Missing or inactive office assignment fails closed; it must not silently use another office.
- Load creation cannot accidentally target a different active branch due to ordering.
- Direct assignment geofence and audit office IDs are the same intended office.
- Both driver-creation overloads enforce the same duplicate phone/code rules.
- Concurrent attempts cannot create duplicate codes/phones or active vehicle assignments.
- Existing Android background tracking and current Phase 1 app screens still work.

## Not included in this draft

- No `GRANT` / `REVOKE` changes.
- No blanket RLS policies.
- No edits to production function definitions.
- No data cleanup, deletion, or constraint/index creation.
- No merge to `main` and no deployment.

## Next implementation step

Build a complete replacement definition for each affected function from the live catalog, apply the edits on a non-production/local database or isolated Supabase branch, run the acceptance tests above, and only then prepare a reviewed migration. The current snippets are design patches and must not be run as a migration by themselves.
