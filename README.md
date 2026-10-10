# Tiba-Supplies — Phase 1

Arabic-first operations dashboard for Tiba-Supplies transport loading operations.

## Phase 1 scope

- Authenticated operations dashboard connected to Supabase (no demo/mock data fallback).
- Operational office is the active `HEAD` office: **مكتب طيبة للتوريدات - الإسماعيلية**.
- Driver check-in office is the active `BRANCH` office: **مكتب طيبة للتوريدات - رأس سدر**.
- Load-order creation with active factory, active quarry, requested trip count, and priority.
- Read-only overview of orders, bookings, actual loading records, active drivers, and active vehicles.
- Does not automatically assign historical drivers to vehicles. Vehicle-owner management and driver matching remain separate workflows.

## Supabase configuration

Create local environment values based on `.env.example`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Use the Supabase **publishable/anon client key only** in browser builds. Never place a service-role key in frontend environment variables.

## Database migrations

Apply these migrations in filename order if they are not already applied:

1. `supabase/migrations/20261009_phase1_live_core.sql`
2. `supabase/migrations/20261010_create_load_order_rpc.sql`
3. `supabase/migrations/20261010_separate_operational_and_checkin_offices.sql`

The office-separation migration preserves Ras Sedr as the driver check-in location, creates/uses Ismailia as the operational office, and updates the snapshot/dispatch/delivery RPCs. If the database already has the changes, do not re-run ad-hoc edits; use the migration's idempotent checks and the verification SQL under `supabase/tests`.

## Run locally

```bash
npm install
npm run dev
```

## Build checks

```bash
npm run lint
npm run build
```

## Google AI Studio

Import the GitHub repository's **main** branch after the Phase 1 PR is merged. Configure the two Vite environment variables in the build/runtime environment supported by the AI Studio project. If AI Studio imports the repository before the merge, it will only see the existing default-branch version.

## Data safety

- Supabase is the system of record; Excel files are source/reference material, not a daily import process.
- No destructive migration is part of the Phase 1 workflow.
- No driver-to-vehicle assignment is created by the load-order creation flow.
