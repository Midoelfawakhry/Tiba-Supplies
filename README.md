# Tiba-Supplies — Shadow Phase 1

Arabic-first operations application for organizing transport loading operations. This branch is the independent Shadow application workspace.

## Phase 1 workflow

1. **Main Office** creates a load order as a draft, selects an active factory and quarry, sets requested trip count and priority, then publishes it.
2. **Driver eligibility** is evaluated server-side using the driver's active account, current driver-to-vehicle assignment, current location, location freshness/accuracy, and the configured Ras Sedr geofence.
3. **Direct assignment** links a published order to an eligible driver and that driver's currently assigned active vehicle. Server-side checks remain authoritative.
4. **Actual loading and trip progress** are recorded against the specific booking/order relationship. Actual records must not be inferred from factory/quarry matches alone.
5. **Arrival and delivery** use driver-owned server RPCs with fresh, accurate location data. Delivery confirmation is audited and cannot be duplicated.
6. **Branch Office** has a read-only, office-scoped snapshot. It cannot perform Main Office mutations.
7. **Directories** keep vehicle owners separate from drivers and vehicles; driver-to-vehicle assignments retain their history.

## App variants

- Main Office web / Windows app
- Driver Android app, including native background location tracking
- Ras Sedr Branch app

All Shadow builds must target the dedicated Shadow Supabase project. Do not configure a production database URL or service-role key in frontend build variables.

## Local setup

Create a local `.env` from `.env.example` and set:

- `VITE_SUPABASE_URL` — the Shadow project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the Shadow publishable key

Never put a service-role key in browser or Android client configuration.

Install dependencies and run the checks:

```bash
npm ci
npm run test:phase1
npm run lint
npm run build
```

## Database and test policy

- Shadow Supabase is the only database target for this branch.
- Review migration state before applying any migration; do not re-run ad-hoc SQL to compensate for a migration mismatch.
- Do not create fake operational records in the shared Shadow database to make screens appear populated.
- Use isolated synthetic fixtures for integration and end-to-end tests.
- The source-level contract tests do not replace authenticated database runtime tests or device smoke tests.

## Release gate

Do not call the Shadow app release-ready until all of the following are evidenced:

- Phase 1 contract and authorization tests pass.
- TypeScript check and production web build pass.
- Shadow database RPC authorization and workflow acceptance tests pass.
- Driver, Main Office, and Branch app variants are tested independently.
- Driver background tracking, permissions, stale-location behavior, and login/logout are verified on a real Android device.
- Signed APK artifacts are generated and their installation is smoke-tested.

This document describes the Shadow application only. It does not authorize production deployment or release.
