# Migration File Audit — Phase 1 Shadow

Audit date: 2026-10-14
Branch: `shadow/phase1-hardening`

## Findings
The migration directory contains a mix of timestamped and date-only filenames. This makes a deterministic fresh replay unsafe until the naming and ledger reconciliation is completed.

Examples of date-only or mixed naming:
- `20261010_create_load_order_rpc.sql`
- `20261010_create_operational_driver.sql`
- `20261010_create_operational_vehicle.sql`
- `20261010_driver_portal_geofence.sql`
- `20261011125635_20261011150000_rebuild_head_owned_cancellation.sql`
- `20261011125637_20261011151000_dispatch_from_head_queue.sql`
- `20261011125640_20261011152000_cancel_in_transit_redirect_delivered.sql`

These names must not be silently renamed because the deployed migration ledger uses its own version values. A rename could make an already-applied change look pending or create duplicate version IDs.

## Dependency observations
- `20261009_phase1_live_core.sql` creates `get_phase1_snapshot()` and references core tables that must already exist; it is not a bootstrap schema.
- `20261010_create_load_order_rpc.sql` creates an RPC against existing office, factory, quarry and load-order records.
- `20261010_create_operational_driver.sql` alters `drivers` and defines operational driver/vehicle logic, so `drivers` and related tables must exist first.
- `20261010_create_operational_vehicle.sql` alters `vehicles`, creates a unique vehicle-code index and a sequence; its preconditions include the `vehicles` table.
- `20261010_driver_portal_geofence.sql` depends on office, driver, vehicle and live-location structures.

## Safe remediation
1. Preserve all existing migration files as historical evidence.
2. Export canonical schema-only DDL from the source database.
3. Build a separate, versioned clean-install baseline in a new reviewed directory; do not fabricate historical ledger entries.
4. Use a reconciliation manifest with columns: repository filename, ledger version, checksum, observed database effect, classification, dependency, and disposition.
5. Replay only into the isolated Shadow project after each dependency and security review is signed off.

## Prohibited shortcuts
- Do not apply the existing directory wholesale to an empty project.
- Do not infer missing schema from frontend TypeScript types.
- Do not copy production rows, authentication users, or secrets into Shadow.
- Do not add broad RLS policies just to make the UI work.
