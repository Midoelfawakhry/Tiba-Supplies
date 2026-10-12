# Tiba Intelligence — Analysis Data Contract

## Purpose
A read-only analytics module for Tiba-Supplies. It is exclusively for the MAIN OFFICE (مكتب طيبة الرئيسي بالإسماعيلية). It must not serve Ras Sedr branch operations, and must not change operational workflows, office UI, branch UI, or DriverApp. Analytics access and filters must be scoped to the main office only.

## Source of truth
Supabase production schema and generated database types are canonical structural references. See `database.types.ts`. This is schema/type documentation, not a dump of personal or operational records.

## Rules
- Do not infer timestamps that are not stored.
- Treat direct assignment and load distribution as distinct workflows.
- The `Confirm` event is used ONLY for direct assignment acceptance latency (assignment created -> driver confirmation), never for load-distribution analytics.
- Waiting-list, actual-loading, booking, delivery and location events must each use their own recorded timestamps and lifecycle semantics.
- Mark incomplete or missing timestamps as unavailable; never silently substitute current time.
- Report cancelled/reassigned/duplicate records separately; don't silently mix them into completed-cycle metrics.
- Report sample size, time window, median, mean, P90, configurable SLA rates, and missing-event counts.
- Analytics are read-only and permission-scoped. Never expose auth secrets, passwords, tokens, or service-role keys.
- Avoid copying raw personal data into analytics artifacts. Prefer IDs/aggregates; expose driver-identifying details only to authorized users for legitimate operational purposes.

## First analysis: main-office direct assignment confirmation latency
For direct assignments only:
`latency = confirmed_at - assigned_at`
First verify the canonical assignment table/event and timestamp columns from the live schema and SQL functions. Do not assume names from UI labels. Track confirmed, pending, cancelled, reassigned and invalid/missing timestamp cases separately.
Metrics: count, mean, median, P90, percent within configurable SLA thresholds, oldest pending age, by day/hour, and cohort by vehicle/driver where access permits.

## Separate analytics domains
1. Direct assignments: assignment-to-confirmation and acceptance outcomes.
2. Load distribution: distribution/booking/loading counts and transitions, with no Confirm metric.
3. Main-office queues and workflow stages: analyze only queue records and workflow stages owned by the main office, using their real arrival/start/end timestamps. Exclude Ras Sedr branch waiting-list operations.
4. Actual loading: recorded weight, factory, quarry, vehicle, trip code, sequence, load date, delivery confirmation timestamp and available delivery coordinates.
5. Fleet and movement: include only if explicitly needed by the main office's analytics and authorized by its data scope; never calculate or present branch-specific Ras Sedr operational analytics in this tool.
6. Data quality: missing timestamps, orphaned references, duplicate lifecycle events, impossible chronology and stale GPS.

## Data discovery checklist
- Inspect tables, views, functions/RPCs, foreign keys, enums, indexes, RLS and grants.
- Inspect operational RPC definitions before relying on UI labels.
- Identify event timestamp semantics and state transitions.
- Verify office ownership and row-level access for every source; do not include Ras Sedr branch operational records.
- Build aggregate queries/views with explicit permissions; no unrestricted data export.
- Test zero records, null timestamps, duplicate events, cancelled/reassigned trips and timezone boundaries.

## Current scope
This is a specification and schema reference only. No production data migration, operational write, or DriverApp change is authorized by this document.
