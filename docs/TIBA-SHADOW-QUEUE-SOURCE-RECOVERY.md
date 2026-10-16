# Queue Migration Source Recovery — reviewed 2026-10-17

## Current branch state

The queue schema migration is now present on `shadow/phase1-hardening`:

`supabase/migrations/20261015180000_phase1_queue_selection_and_atomic_dispatch.sql`

Current branch blob SHA: `e2464ea452dbbbda7ae9580caf24ce2b17a190dc`.

The file was compared with the same path at historical commit `236abc8eda9b5e821f3c005af9f77a53cf7998c5` (historical blob SHA `b388453e9126e9d38844ab705af5aded4753e85c`). The current file separates the scheduler block and keeps the schema/RPC migration free of the `pg_cron` installation and scheduling side effect. The rest of the compared source lines are materially aligned; the blob is not byte-identical, so do not describe it as the exact historical file.

## Queue objects and dependencies

The migration creates or alters:
- `dispatch_windows`
- `waiting_list_entries`
- `driver_load_choices`
- `load_orders.dispatch_window_id`
- queue publication, selection, allocation, and finalization RPCs
- RLS and direct table privilege restrictions for the queue tables

It depends on a working foundational schema and compatible definitions for `offices`, `app_users`, `drivers`, `driver_live_locations`, `load_orders`, `bookings`, `notifications`, and `audit_log`. It also references helper functions and the `driver_vehicle_assignments` relation, whose name/columns do not match Production's `vehicle_driver_assignments(assigned_from, assigned_to)` model. It must not be applied until that mismatch is deliberately resolved.

## Scheduler is now a separate optional deployment migration

File: `supabase/migrations/20261015186000_phase1_queue_scheduler.sql`
Blob SHA: `b34b0ac5096b640c38d7797a76f66e9c76cc8813`.

This file installs `pg_cron` and schedules `tiba-finalize-expired-dispatch-windows` every minute. It is explicitly optional and should only be applied to a target that supports `pg_cron`. Keep this operational side effect separate from clean-chain schema/RPC validation.

## What this resolves and what remains blocked

Resolved:
- The queue schema/RPC migration is available on the current review branch.
- The scheduler side effect has a separate optional migration.
- Historical source provenance and the current blob difference are recorded.

Still blocked:
- authoritative foundational CREATE TABLE source for the full core schema;
- three Production migration source gaps (`20261011004642`, `20261011020800`, `20261011022028`); exact expected paths were checked across the currently reachable review/design/release branches and not found;
- canonical driver/vehicle assignment relation and booking lifecycle;
- compatibility of queue RPCs with v191 client contracts and current office-role model;
- disposable clean PostgreSQL bootstrap and authorization/concurrency tests.

## Safety

No SQL was applied. Production remains read-only. The Shadow project is not to be initialized until the complete ordered chain passes clean-bootstrap and contract gates. This document is source/dependency review, not deployment approval.
