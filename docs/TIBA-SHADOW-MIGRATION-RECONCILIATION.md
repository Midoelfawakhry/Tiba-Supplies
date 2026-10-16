# Tiba Shadow Migration Reconciliation — Review Notes

Date: 2026-10-16
Repository: `Midoelfawakhry/Tiba-Supplies`
Working branch: `shadow/phase1-hardening`
Intended new target: Supabase project `bvyxiahpxogblkmtjxyx` (Tiba Shadow)
Application compatibility baseline: Version 191

## Safety decision

Do not apply the current `supabase/migrations` directory wholesale to the new target. It contains 107 files with legacy/nonstandard timestamps and Phase 1 migrations that assume prior objects. The new target currently reports no public tables and no migration history. No database changes are authorized by this review note.

## Verified findings

- Latest Phase 1 CI run (run ID 38930207964, commit `6f372459863823cd2cb38a90628a3d7d08fa40a6`) passed `npm run lint`, `npm run test:phase1`, `npm run build`, and disposable PostgreSQL SQL regression steps.
- Both Android workflow definitions currently pin the Supabase URL to `https://awgppfjxegognuqozldl.supabase.co`, not the intended target `https://bvyxiahpxogblkmtjxyx.supabase.co`. Do not change production or signed-release workflows until the new schema and target build are validated.
- The intended target currently has no public tables, no recorded migrations, and no Edge Functions.
- The clean baseline defines offices, app users, factories, quarries, vehicle owners, vehicles, drivers, load orders, bookings, actual loading records, delivery confirmations, driver live locations, notifications, and audit log.
- Later Phase 1 migrations additionally depend on objects including driver/vehicle assignment history, dispatch windows, waiting-list entries, driver load choices, sequences, and further lifecycle/security functions. These dependencies must be reconciled into the clean migration sequence.
- The repo's greenfield baseline guidance explicitly says not to replay the mixed legacy migration folder wholesale and to avoid production writes/deployments.

## Required migration reconciliation

1. Freeze the Version 191 UI and RPC contract as the compatibility specification. Extract every RPC name, argument signature, response field, and enum/status expected by the client.
2. Build a dependency inventory for every table, enum, sequence, function, trigger, index, grant, and RLS policy referenced by the current client and selected Phase 1 migrations.
3. Create a clean, ordered migration chain for the intended target only. It must include the required dispatch/queue objects before functions that reference them, and explicit grants/RLS after functions are created.
4. Run the chain on a disposable PostgreSQL/Supabase test environment from an empty database. Test clean install, re-run/idempotence where intended, authorization boundaries, concurrent assignment, lifecycle transitions, tracking freshness/geofence, and actual-weight idempotency.
5. Deploy the reconciled chain to the intended Shadow project only after the disposable tests pass. Then deploy required Edge Functions and run authenticated integration tests with controlled identities.
6. Create a separate test APK build configured for the intended target, verify the URL is embedded, install/smoke-test Office, Branch, and Driver modes, and compare behavior against Version 191.
7. Only after acceptance, update the approved build path. Do not migrate real operational data from either older database without an explicit data mapping and reconciliation plan.

## Release blockers

- Migration chain has not yet been proven as a complete clean install.
- The current Android workflows target a different Supabase project.
- Target Edge Functions and authenticated runtime behavior are not yet provisioned/verified.
- APK artifacts/device installation and parity with Version 191 are not yet evidenced.

This document is a review checkpoint, not a claim that the database has been migrated or that a release is ready.
