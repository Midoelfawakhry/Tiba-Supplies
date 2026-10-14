# Phase 1 Acceptance Matrix

Branch: shadow/phase1-hardening
Status: planned checks; not yet executed against a database.

| Area | Scenario | Expected result | Current evidence |
| --- | --- | --- | --- |
| Authentication | No authenticated user calls the snapshot | Request rejected | Static SQL review only |
| Role access | Inactive or role-less app user calls the snapshot | Request rejected | Static SQL review only |
| Office scope | Branch user requests snapshot with no active office assignment | Fail closed | Not yet implemented/tested |
| Office scope | Branch user has an active assignment to Office A | Only Office A operational data returned | Not yet implemented/tested |
| Load relation | Two load orders share the same factory and quarry | Actual record linked through booking.load_order_id to exactly its order | Current snapshot still uses factory/quarry join |
| Legacy record | Actual record has no booking_id | Flag for reconciliation; do not guess an order | Policy required |
| Delivery | Driver tries to confirm another driver's booking | Rejected | Migration source contains ownership check; runtime test pending |
| Delivery | Delivery already confirmed | Second confirmation rejected | Migration source contains duplicate guard; runtime test pending |
| Cancellation | Booking is delivered or has actual delivery recorded | Cancellation rejected | Migration source contains guards; runtime test pending |
| Geofence | GPS location is missing, stale, or outside configured radius | Driver cannot see/receive new eligible loads | Static source review only |
| Build | TypeScript and production build | Both succeed | Not run in this session |

## Shadow environment gate
The Shadow project was queried read-only on 2026-10-14 and returned zero public tables and zero migration-ledger entries. Do not run application acceptance tests or apply feature migrations until a reviewed, schema-only bootstrap has been prepared and reconciled with the canonical migration history.

## Production safety
No production schema/data changes are part of this checklist. Any later rollout requires successful Shadow checks and a separate approval.
