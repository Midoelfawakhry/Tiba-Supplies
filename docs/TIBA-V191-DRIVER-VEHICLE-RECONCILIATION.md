# Tiba-Supplies v191 — Driver/Vehicle Data Model Reconciliation

Date: 2026-10-16
Branch: `shadow/phase1-hardening`
Scope: historical-source reconciliation for the unchanged v191 client. No database writes.

## Historical assignment model recovered
The historical migration `20261010_create_operational_driver.sql` writes driver/vehicle links to `public.vehicle_driver_assignments` using:
- `driver_id`
- `vehicle_id`
- `assigned_from`
- `assigned_to`

The historical live-tracking migration `20261010_vehicle_live_tracking.sql` reads the same relation, requires an active assignment where `assigned_to IS NULL` and `assigned_from <= now()`, and stores `vehicle_id` with each live location.

The native tracking Edge Function and newer queue SQL instead reference `public.driver_vehicle_assignments`, using `assigned_at` and `ended_at`. This is not a cosmetic naming difference: both models encode active assignment differently.

## Decision required before bootstrap
Do not create both tables and do not blindly rename either relation. Inspect the pinned v191 native tracking Edge Function, all selected RPC bodies, and current client data assumptions, then choose one canonical model. If adapting a historical source, make the adaptation explicit in a new clean migration and test:
- assigning a vehicle to one driver;
- preventing simultaneous active driver/vehicle assignments;
- ending and replacing an assignment without rewriting history;
- selecting the current vehicle deterministically;
- matching location records to the current vehicle;
- rejecting a queue allocation when no current valid assignment exists.

## Additional confirmed drift in historical sources
- The queue finalizer writes `bookings.direct_acceptance_status`, absent from the clean baseline's `bookings` definition.
- The direct-assignment historical source writes statuses such as `BOOKED` and `LOADING_STATEMENT`, while the clean baseline constrains booking status to `ASSIGNED`, `ARRIVED`, `LOADING`, `LOADED`, `IN_TRANSIT`, `DELIVERED`, and `CANCELLED`. These are incompatible vocabularies and cannot be mixed without an explicit lifecycle mapping.
- The old direct acceptance source writes columns into `actual_loading_records` such as `load_date`, `vehicle_id`, `driver_id`, `quarry_id`, and `factory_id`; those columns are absent from the clean baseline definition.
- The historical portal snapshot is named `get_driver_portal_snapshot()`, but v191 calls `driver_get_portal_snapshot()`. Keep the client name authoritative unless a reviewed compatibility change is explicitly approved.
- Historical direct assignment returns `success` and `status`; v191's client acceptance handler expects `accepted`, `acceptance_status`, and `accepted_at`. Response shape drift is also a breaking contract.

## Version 191 guardrails
- Preserve current client RPC names, named argument keys, response fields, error handling expectations, AI assistant behavior, native background tracking, and signed release workflow.
- Do not infer the exact APK's source commit from the version label alone; pin and record the release source SHA before declaring the source contract final.
- No SQL has been applied to Shadow or Production as part of this reconciliation.
