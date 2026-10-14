# Shadow Phase 1 Main Office RPC Deployment Evidence

Date: 2026-10-14
Branch: shadow/phase1-hardening

## Applied to Shadow
Migration `20261014200000_phase1_main_office_rpcs.sql` was applied successfully to project `Tiba-Supplies-Shadow` (`awgppfjxegognuqozldl`). Production was not targeted.

## Functions introduced
- `current_main_office_user()`: resolves an authenticated active app user whose active office is MAIN / HEAD_OFFICE.
- `main_office_upsert_directory(...)`: creates factory, quarry, vehicle owner, vehicle, or driver records. Vehicles and drivers link to the canonical Ras Sedr branch.
- `main_office_set_directory_active(...)`: activates/deactivates master data without hard-deleting history.
- `main_office_create_load_order(...)`: creates a DRAFT order after validating active factory/quarry and positive quantity/priority.
- `main_office_publish_load_order(uuid)`: locks and publishes a DRAFT order.
- `write_audit_event(...)`: internal audit writer, not executable by authenticated clients.

## Verified
Read-only catalog query confirms the six functions exist as SECURITY DEFINER functions. Client execute is granted to authenticated only for the current-user helper and four Main Office RPCs; the audit writer is postgres-only. Functions enforce Main Office identity internally.

## Not yet complete
- No Main Office account has been provisioned.
- No end-to-end RPC calls have been tested with real auth identities.
- Direct assignment, geofence, driver queue, arrival, actual loading, delivery, cancellation, notifications, and read/list RPCs are not deployed yet.
- Master-data RPC creates entities and toggles active state; edit/update semantics and friendly duplicate-error handling need dedicated operations.
- RLS is enabled and direct table access is revoked; read APIs must be added deliberately.
- Driver-originated audit events will need a separate narrow path if required.

No production writes or deployments were performed.