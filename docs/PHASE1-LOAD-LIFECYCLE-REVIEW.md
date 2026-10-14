# Phase 1 Load Lifecycle Review

Review date: 2026-10-14
Branch: shadow/phase1-hardening

This is a static source review. No production data or schema was changed during this review.

## Confirmed relationships in the baseline
- `bookings.load_order_id` references `load_orders.load_order_id`.
- `actual_loading_records.booking_id` references `bookings.booking_id`, is NOT NULL, and is unique in the clean Phase 1 baseline.
- `delivery_confirmations.booking_id` references `bookings.booking_id` and is unique.

## Actual-loading join review
The current `branch_get_snapshot()` migration already follows the correct relationship path:

`actual_loading_records al → bookings b ON b.booking_id = al.booking_id → load_orders lo ON lo.load_order_id = b.load_order_id`

It does **not** match load orders by factory/quarry pair. This means two orders that share a factory and quarry remain distinguishable by booking/order identity. The earlier concern in this document that the current snapshot used a factory/quarry join was inaccurate and is corrected here.

The clean baseline also disallows a null `booking_id` for actual-loading records. A legacy/manual record without a booking link cannot be inserted into this baseline as defined. If historical imports are introduced later, they should be handled through an explicit reconciliation/import design, not by guessing an order.

## Remaining validation
1. Add a regression contract test to prevent the snapshot from regressing to a factory/quarry join.
2. Test two separate orders with the same factory/quarry pair and verify the actual record resolves through its booking to exactly one order.
3. Validate office scoping against the approved office model. The baseline has no `office_id` column on `load_orders`; do not claim a per-order office filter exists until the data model explicitly supports it. Branch visibility currently scopes allocations/loading through driver and vehicle office assignments.
4. Keep authorization, delivery ownership, duplicate confirmation, cancellation, and geofence checks under runtime acceptance testing.

## Status
Static source review only. Runtime database acceptance has not been proven by this document. Shadow must be checked directly before claiming live runtime validation. Production remains untouched.
