# Shadow Load Cancellation RPC Evidence — 2026-10-14

## Scope
Applied only to Shadow Supabase project `awgppfjxegognuqozldl`. Production was not modified.

## Migration
- File: `supabase/migrations/20261014220000_phase1_cancel_load_order.sql`
- Function: `public.main_office_cancel_load_order(uuid, text)`
- Git commit: `8f66e5528c05039f34c45dd73921ca75f0b8557d`

## Verification
A read-only catalog query confirmed:
- Function exists in `public`.
- Function is `SECURITY DEFINER`.
- `authenticated` has EXECUTE permission.
- The same query reconfirmed the direct-assignment RPC is present and executable.

## Guardrails
- Requires an authenticated Main Office actor through `current_main_office_user()`.
- Requires a non-empty cancellation reason.
- Locks the load order before checking/updating state.
- Rejects already completed/cancelled orders.
- Rejects cancellation if any associated booking has progressed to LOADING, LOADED, IN_TRANSIT, or DELIVERED.
- Cancels only ASSIGNED/ARRIVED bookings when cancelling the order, records reason/timestamps, and writes an audit event.

## Not yet verified
No end-to-end invocation was performed; the Shadow environment still lacks a provisioned test Main Office identity and operational fixture data. App/UI integration and full lifecycle integration tests remain pending.
