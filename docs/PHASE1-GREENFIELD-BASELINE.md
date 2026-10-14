# Tiba-Supplies — Greenfield Phase 1 Baseline

Date: 2026-10-14
Branch: shadow/phase1-hardening

## Authoritative project direction
The application is being built from zero. Treat all operational workflows and operational data as not yet established. Do not rely on legacy bookings, load orders, delivery confirmations, or actual-loading records as existing business truth. Prior files and migrations are reference material only; they must be evaluated and selectively reused, not replayed or treated as the baseline.

The Shadow database being empty is expected and appropriate at this stage. Build a clean baseline for Shadow, then validate it before any production rollout.

## Product authority model
Exactly two offices:
- Main Office (`HEAD_OFFICE`): the only operational data-entry and management authority.
- Ras Sedr Office (`BRANCH`): the single active location/branch reference used for the location model. It does not have office-operation write authority.

The Main Office manages factories, quarries, drivers, vehicles, vehicle owners, load orders, direct assignment, cancellation, monitoring, and operational administration. Driver self-service is limited to authenticated actions explicitly assigned to the driver, such as own location, arrival, and delivery confirmation where the workflow allows them.

Drivers and vehicles may be assigned to Ras Sedr as the canonical operating location. That assignment does not grant branch users permission to perform office administration.

## Build-from-zero rules
1. Design the domain model and workflows first; migrations follow the approved model, not the other way around.
2. Create a clean, ordered baseline migration set specifically for Shadow. Do not replay the mixed legacy migration folder wholesale.
3. Make every entity, relationship, lifecycle status, permission, and audit event explicit.
4. Use stable primary keys, foreign keys, check constraints, and unique constraints for business invariants.
5. Apply least privilege: deny by default, role enforcement in database functions/Edge Functions, RLS, and explicit RPC grants.
6. Define soft-deactivation for master data and preserve operational history once records exist. Hard deletion of referenced operational records must be restricted.
7. Define geofence policy (canonical Ras Sedr coordinates, configured radius, location freshness, future timestamp tolerance, accuracy handling) centrally, not duplicated across clients.
8. Direct assignment must be atomic, conflict-checked, and auditable.
9. Include seed/reference configuration only for non-sensitive baseline data. Never seed real users, secrets, tokens, or production business records.
10. Keep all work on `shadow/phase1-hardening`; no production writes or deployments.

## Phase 1 build order
A. Domain model and state diagrams.
B. Canonical clean schema for offices, roles/users, factories, quarries, vehicle owners, vehicles, drivers, office assignments, load orders, bookings/assignments, actual loading records, delivery confirmations, location events, notifications, and audit log.
C. RLS/grants and SECURITY DEFINER/RPC design.
D. Geofence and direct-assignment logic.
E. UI/API integration and generated types.
F. Seed safe reference data for Shadow.
G. Automated tests and acceptance evidence.
H. Android build pointed only to Shadow; no production publish from the development branch.

## Current interpretation
Existing repository SQL is legacy/reference input. The app's real starting point is a reviewed clean schema and workflow. The old operational tables/functions are not assumed to contain real data or represent a completed workflow. Avoid more security patch notes against the old snapshot as the main implementation strategy; instead design and implement a clean Phase 1 baseline.
