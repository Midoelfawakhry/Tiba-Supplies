# Shadow Direct Assignment RPC Evidence — 2026-10-14

## Scope
Applied only to Shadow Supabase project `awgppfjxegognuqozldl`. Production project `tnlcvwtphbunteifoonc` was not modified.

## Migration
- File: `supabase/migrations/20261014210000_phase1_direct_assignment.sql`
- Function: `public.main_office_direct_assign(uuid, uuid, uuid)`
- Git commit: `4fc2014e8f280ed2c9a5f5e1064cd8db4e5a2bb0`

## Verification
A read-only catalog query after applying the migration returned:
- Function exists in `public`.
- `prosecdef = true` (SECURITY DEFINER).
- Signature: `p_load_order_id uuid, p_driver_id uuid, p_vehicle_id uuid`.
- `authenticated` has EXECUTE permission.

## Implemented checks
- Requires a Main Office user via `current_main_office_user()`.
- Requires an existing `PUBLISHED` load order.
- Requires active driver and vehicle, both assigned to the active Ras Sedr branch.
- Checks active bookings for the selected driver and vehicle before assignment.
- Creates a DIRECT / ASSIGNED booking, marks the order IN_PROGRESS, inserts a driver notification, and records an audit event in the same transaction.

## Not yet verified
- No end-to-end call was run because the Shadow project has no provisioned test Main Office identity and no operational seed data.
- Concurrency and duplicate-assignment behavior still require automated/integration testing; unique database indexes remain an important backstop.
- App/UI integration is not implemented by this migration.
