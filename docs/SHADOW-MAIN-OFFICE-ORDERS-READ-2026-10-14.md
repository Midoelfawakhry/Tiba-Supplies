# Phase 1 Orders Read RPC

- Shadow-only migration name: `phase1_main_office_orders_read`
- Function: `public.main_office_get_orders()`
- Purpose: return load orders with factory and quarry names for the Main Office dashboard.
- Authorization: calls `public.current_main_office_user()` before returning any data; execute permission is granted to authenticated and revoked from public/anon/authenticated before the explicit grant.
- Applied to Shadow project `awgppfjxegognuqozldl`.
- Production was not modified.
- Verification caveat: a follow-up catalog query was blocked by the tool safety layer, so post-apply catalog verification is pending. No UI integration or end-to-end execution has been performed.
