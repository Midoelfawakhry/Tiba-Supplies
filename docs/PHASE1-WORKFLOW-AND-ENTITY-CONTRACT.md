# Phase 1 Workflow and Entity Contract

Branch: shadow/phase1-hardening
Status: greenfield design baseline

## Core workflow
1. Main Office creates and maintains master data: factories, quarries, vehicle owners, vehicles, and drivers.
2. Main Office creates a load order in DRAFT with factory, quarry, requested quantity, and priority.
3. Main Office validates and publishes the order. Only PUBLISHED orders can be offered to eligible drivers or directly assigned.
4. Direct assignment: Main Office selects one active driver and one active vehicle. The server verifies both are active, both are associated with Ras Sedr as configured, the order is PUBLISHED, and neither has another active assignment. The transaction creates one booking with assignment_type=DIRECT and records the actor.
5. Driver queue/acceptance (if enabled): only authenticated active drivers with a fresh location inside the configured Ras Sedr radius may see/accept eligible queue work. Queue assignment uses a transaction/lock and the same active driver/vehicle conflict checks. An already assigned booking remains visible to its own driver regardless of subsequent location changes.
6. Arrival: driver submits coordinates and captured_at; server rejects invalid coordinates, future timestamps beyond tolerance, stale fixes, and unacceptable accuracy according to one central policy.
7. Actual loading: authorized workflow records positive actual weight and optional ticket/scale image against the specific booking. Do not infer the order by factory/quarry match.
8. Transit and delivery: a valid loading record is required before delivery confirmation. The authenticated driver must own the booking; confirmation stores captured delivery coordinates and timestamp.
9. Closeout: Main Office can monitor progress and cancel/redirect only while the booking/order state permits it. A completed delivery cannot be cancelled or overwritten; corrections should be auditable.
10. Notifications are emitted for order publication, direct assignment, state transitions, and relevant cancellation outcomes.

## Suggested state model
### Load order
DRAFT -> PUBLISHED -> IN_PROGRESS -> COMPLETED
DRAFT/PUBLISHED/IN_PROGRESS -> CANCELLED subject to guards.
A DRAFT order is not visible to drivers.

### Booking
ASSIGNED -> ARRIVED -> LOADING -> LOADED -> IN_TRANSIT -> DELIVERED
ASSIGNED/ARRIVED may transition to CANCELLED under Main Office policy. Later-stage cancellation requires explicit business rules; default deny.

State changes must be performed by validated server-side operations, not arbitrary client updates.

## Entity ownership
- offices: exactly MAIN/HEAD_OFFICE and RAS_SEDR/BRANCH.
- app_users: office staff identities linked to auth.users; operational management is reserved for Main Office. Create no seeded login or password.
- drivers: optional auth link for driver portal; their office reference is Ras Sedr.
- vehicles: office reference is Ras Sedr; ownership is a separate vehicle_owners relationship.
- factories and quarries: managed by Main Office; active state controls future use without deleting history.
- load_orders: authored by a Main Office app user.
- bookings: one order, one driver, one vehicle, one assigning app user; direct assignment is explicit.
- actual_loading_records: one record per booking in Phase 1 baseline; positive weight.
- delivery_confirmations: one record per booking; authenticated driver identity and location.
- driver_live_locations: latest accepted location only; history can be added later as a separate location_events table if the UI/operational need is confirmed.
- notifications: exactly one recipient (driver or office user).
- audit_log: append-only application audit target; access must be tightly restricted.

## Rules needing centralized configuration
- Ras Sedr latitude/longitude: intentionally left NULL until the verified office coordinates are supplied. Geofence eligibility must fail closed while coordinates are NULL.
- Geofence radius: 10,000 metres by default.
- Location freshness: 10 minutes as initial policy, with future timestamp tolerance no greater than 1 minute.
- Direct assignment: Main Office only; must be atomic and audit actor and chosen driver/vehicle.
- Delete: master data deactivation; no hard-delete of records referenced by operational history.

## Pre-acceptance checks
- Validate every status transition with server-side tests.
- Validate cross-role denial with direct RPC calls, not just UI tests.
- Validate duplicate active driver/vehicle assignment is rejected under concurrent attempts.
- Validate missing Ras Sedr coordinates disables geofence-eligible queue operations.
- Validate every booking's actual-loading and delivery record follows booking_id.
- Verify the UI consumes only explicit safe response fields.
