# Shadow Bootstrap Gate — Schema and Relationship Evidence

Date: 2026-10-14
Branch: shadow/phase1-hardening

## Read-only production metadata verified
A read-only information_schema query confirmed these foreign-key paths in the production schema:
- actual_loading_records.booking_id -> bookings.booking_id
- bookings.load_order_id -> load_orders.load_order_id
- load_orders.office_id -> offices.office_id
- load_orders.check_in_office_id -> offices.office_id
- actual_loading_records.factory_id/quarry_id/driver_id/vehicle_id -> their respective reference tables
- app_users.office_id -> offices.office_id
- user_roles.user_id -> app_users.user_id
- user_roles.role_id -> roles.role_id
- delivery_confirmations.booking_id -> bookings.booking_id

This supports using the direct actual_loading_records -> bookings -> load_orders path for office-scoped dashboard data. It does not establish that every historical actual-loading row has a booking_id; nullable links must be handled deliberately.

## Shadow state
The Shadow project was queried read-only and returned no public tables and no migration-ledger entries. It is not ready for application-level integration tests.

## Bootstrap plan — do not replay blindly
1. Create a schema-only export from the source database, excluding all table data, auth users, storage objects, secrets, and production-only configuration.
2. Review extensions, enums, sequences, tables, constraints, indexes, triggers, functions, views, RLS enablement, grants, and policies as separate inventory items.
3. Reconcile the export against the repository's migration files and the source migration ledger. The repository has mixed timestamp/date-only filenames and known ledger/file drift, so a wholesale migration replay is not a safe bootstrap strategy.
4. Apply the reviewed schema-only baseline to Shadow only.
5. Verify the Shadow catalog against the expected table/column/FK inventory before applying feature changes.
6. Deploy Shadow-only Edge Functions and set Shadow environment variables; never point a Shadow build at the production project.
7. Run the Phase 1 acceptance matrix and report actual pass/fail evidence.
8. Do not change production until Shadow tests pass and rollout is explicitly approved.

## Dashboard query correction direction
The current snapshot's actual-loading subquery joins by factory_id and quarry_id. The intended scoped path is:
actual_loading_records.booking_id = bookings.booking_id
then bookings.load_order_id = load_orders.load_order_id
then filter load_orders.office_id against the authorized office.
Before implementation, define treatment of actual_loading_records rows with NULL booking_id (for example, a separately labeled legacy reconciliation collection). Do not guess their owning order.

## Safety/status
Only metadata reads were performed for this review. No production DDL or data writes were issued. No Shadow schema was applied. No tests are represented as run.
