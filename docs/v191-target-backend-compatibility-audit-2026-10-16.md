# v191 tracking compatibility audit (2026-10-16)

Target: Supabase project `awgppfjxegognuqozldl` (Tiba-Shadow). Read-only inspection only.

## Result
The installed v191 native tracking request matches the deployed RPC contract:
- RPC: `public.driver_update_live_location(double precision, double precision, double precision, timestamptz)`
- Payload: `p_latitude`, `p_longitude`, `p_accuracy_m`, `p_captured_at`
- Function validates authenticated active driver, coordinate ranges, accuracy <= 100 m, timestamp freshness (10 minutes old / 1 minute future), and only replaces a location with an equal/newer captured timestamp.
- Function writes to the existing table fields `driver_id`, `latitude`, `longitude`, `accuracy_m`, `captured_at`, `received_at`.
- Table privileges are not granted to `authenticated`; its RLS is enabled with no direct policies. The intended access path is through the narrowly scoped RPC.
- Location-read RPC derives vehicle identity from the active driver-vehicle assignment and exposes `received_at` as the UI's `updated_at`. The target schema does not need to be reshaped to the separate primary project's table layout merely to support v191.

## Target snapshot
Active drivers: 1. Active assignments: 1. Live location rows: 1. Load orders: 0. Bookings: 0.
Only counts were queried; exact coordinates were not read.

## Decision
Do not add `vehicle_id`, `heading`, `speed_kmh`, or `updated_at` solely to imitate another project's schema. The target's existing RPC/table contract is coherent with v191 and the office location-reading RPC.

No database changes, function deployments, or production changes were made. Next validation is a controlled device test confirming the location timestamp advances in the office view, followed by a permissions/role review of all exposed RPCs. Do not run the other project's migration history against this target without a separate schema reconciliation.
