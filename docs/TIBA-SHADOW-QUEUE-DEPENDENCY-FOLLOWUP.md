# Follow-up: Queue Schema Dependency Check

Date: 2026-10-16
Branch checked: `shadow/phase1-hardening`

## Finding

A repository-wide GitHub code search surfaced a queue migration named `20261015180000_phase1_queue_selection_and_atomic_dispatch.sql` that creates `dispatch_windows`, `waiting_list_entries`, and `driver_load_choices`. However, that file is **not present in the 107-file `supabase/migrations` directory returned for `shadow/phase1-hardening`**. The branch does contain later migrations that alter/use those tables, including `20261015184000_phase1_queue_vehicle_compatibility.sql`, `20261015182000_phase1_queue_driver_notifications.sql`, and `20261015183000_phase1_dispatch_window_serialization.sql`.

This means there is a branch/revision consistency problem to resolve before making a clean migration chain: search-index results from another repository revision must not be treated as source files on the working branch. The queue-table creator must be recovered from the correct intended commit/branch, reviewed, and incorporated into the clean baseline or a properly ordered migration.

## Safety status

- No migration was applied to the intended Supabase target.
- Do not apply the later queue migrations until the creator schema is present and reviewed.
- Do not assume the queue migration from another revision is already available on `shadow/phase1-hardening`.
- Preserve Version 191; validate all RPC signatures and response contracts against the exact commit used for the test APK.

## Next verification

1. Resolve the authoritative queue schema source on the working branch.
2. Compare the exact app source commit, migration branch, and Android workflow target.
3. Build an ordered clean-install chain and run it on disposable PostgreSQL.
4. Only then initialize the intended Shadow project and test an APK configured for that target.
