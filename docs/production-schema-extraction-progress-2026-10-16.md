# Production Schema Extraction Progress — 2026-10-16

## Scope and safety
Read-only inspection of the existing Tiba-Supplies production project `tnlcvwtphbunteifoonc` and the isolated Shadow project `bvyxiahpxogblkmtjxyx`. No production writes, no migrations applied, no data copied, no Edge Functions deployed, and no merge to the default branch.

## Confirmed from live Supabase inspection
- Production project is ACTIVE_HEALTHY in `eu-west-1`, PostgreSQL 17.
- The production public schema has 32 listed tables/views, including `offices`, `app_users`, `roles`, `user_roles`, `drivers`, `vehicles`, `vehicle_owners`, `factories`, `quarries`, `load_orders`, `bookings`, `actual_loading_records`, tracking/session tables, audit tables, and staging tables.
- Read-only catalog query returned foreign-key relationships connecting load records to bookings/drivers/vehicles/factories/quarries; bookings to load orders/drivers/vehicles; vehicles to owners; and user-role records to app users and roles.
- Catalog query lists application RPCs for dispatch, driver management, loading records, account statements, office queues, and live location.
- Six public triggers were returned by the current catalog query: trip-code assignment on bookings and actual loading records, and driver auto-assignment on driver insert/update.
- Edge Functions currently active on production: `create-driver-account` v14, `create-branch-employee` v4, `tiba-ai-assistant` v8, and `driver-native-location` v2. The AI function is explicitly treated as a protected baseline and must not be modified during schema work.
- The isolated Shadow project `bvyxiahpxogblkmtjxyx` currently has no public application tables and no migration records.

## Important limitations / unresolved extraction
- The current database connector can list table metadata and execute selected read-only queries, but attempts to retrieve full `pg_get_functiondef` output were blocked by the tool safety layer.
- A catalog query to `pg_policies` returned no rows even though tables report RLS enabled. This discrepancy must be resolved before claiming policy parity.
- The repository's clean-bootstrap gap analysis already notes that the available migration history does not provide a verified, complete initial CREATE TABLE baseline for the production schema.
- A TypeScript schema export is useful for client types, but is not a substitute for full SQL DDL, triggers, policies, grants, extensions, and function bodies.

## Safe next actions
1. Obtain a trusted schema-only dump from the production project using Supabase CLI / `pg_dump --schema-only` through an authorized client environment, or another supported export path.
2. Compare the dump against the migration files on `shadow/phase1-hardening`.
3. Build and validate a clean bootstrap migration on isolated Shadow only after the complete dump and policy/function definitions are available.
4. Compare object counts, RLS policies, grants, triggers, functions, enum types, indexes, and constraints before moving any application data.
5. Migrate Auth users and Edge Function secrets separately using supported Supabase workflows; never copy secret values into GitHub.

## Current status
Schema extraction and relationship inventory are in progress. This is not a complete or validated migration. Production remains untouched and the isolated Shadow database remains empty.
