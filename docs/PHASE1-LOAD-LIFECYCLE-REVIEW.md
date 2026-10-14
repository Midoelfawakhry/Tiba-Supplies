# Phase 1 Load Lifecycle Review

Review date: 2026-10-14
Branch: shadow/phase1-hardening

This is a static source review. No SQL was executed and no database was changed.

## Confirmed relationships in the reference types
- bookings.load_order_id references load_orders.load_order_id.
- actual_loading_records.booking_id references bookings.booking_id.
- delivery_confirmations.booking_id references bookings.booking_id and is marked one-to-one in the generated reference types.

## Current snapshot concern
The Phase 1 snapshot joins actual_loading_records to load_orders using factory_id and quarry_id, rather than traversing actual_loading_records.booking_id -> bookings.load_order_id. This is a broader match than the direct relationship documented in the reference types and may duplicate or misattribute rows when orders share a factory/quarry pair.

## Safe implementation direction
1. Join actual loading records to bookings by booking_id.
2. Join bookings to load_orders by load_order_id.
3. Filter using the resolved load order's office_id.
4. Keep actual_loading_records with a nullable booking_id in mind; decide whether such legacy/manual records belong in a separate reconciliation list instead of silently dropping or guessing their order.
5. Return explicit fields rather than serializing entire rows.
6. Add tests for multiple orders with the same factory/quarry, a missing booking link, and records belonging to another office.

## Additional operational controls to validate
- Confirm delivery is only accepted for the authenticated driver's own booking.
- Confirm the booking is in an eligible state and actual weight is positive.
- Confirm a delivery confirmation cannot be repeated.
- Confirm cancellation cannot undo a delivered/weighted trip.
- Confirm direct assignment is limited to the HEAD office and location freshness/geofence is checked server-side.

## Status
Findings and suggested join path only. Runtime behavior and live data have not been tested. Shadow remains without tables until a reviewed schema bootstrap is available. Production has not been changed.
