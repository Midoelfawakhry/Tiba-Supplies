# Queue Migration Source Recovery — 2026-10-16

## Recovery result

The queue schema source was recovered exactly from repository commit `236abc8eda9b5e821f3c005af9f77a53cf7998c5`:

`supabase/migrations/20261015180000_phase1_queue_selection_and_atomic_dispatch.sql`

The file is not present in the current `shadow/phase1-hardening` migration directory listing, but it is retrievable at the cited historical commit:
https://github.com/Midoelfawakhry/Tiba-Supplies/blob/236abc8eda9b5e821f3c005af9f77a53cf7998c5/supabase/migrations/20261015180000_phase1_queue_selection_and_atomic_dispatch.sql

It creates:
- `dispatch_windows`
- `waiting_list_entries`
- `driver_load_choices`

It also alters `load_orders`, defines queue selection/publication/finalization RPCs, configures RLS/grants, and references the core tables `offices`, `app_users`, `drivers`, `load_orders`, and `bookings`.

## Important additional deployment dependency

The recovered file enables `pg_cron` and schedules a recurring job named `tiba-finalize-expired-dispatch-windows` every minute. This is an operational side effect, not just table/function DDL. Before incorporating the file into a clean bootstrap, verify that `pg_cron` is supported/enabled in the intended target and decide whether scheduling should be provisioned separately. Do not blindly apply this file to the target.

## What this resolves and what it does not

Resolved: an exact historical source for the queue tables and their related RPCs has been located, with commit provenance.

Not resolved: the authoritative foundational CREATE TABLE sources for the core schema and the three missing production migration sources remain to be recovered/reconciled. The current working branch still does not contain this queue migration, so it must not be silently treated as part of that branch's migration sequence.

## Safety

No SQL was applied. No Shadow or production database was modified. This is source recovery only.
