# Phase 1 Acceptance Matrix

Branch: shadow/phase1-hardening
Status: source-level regression coverage being added; database runtime acceptance is still pending.

| Area | Scenario | Expected result | Current evidence |
| --- | --- | --- | --- |
| Authentication | No authenticated user calls the snapshot | Request rejected | Source guard present; runtime test pending |
| Role access | Inactive or role-less app user calls the snapshot | Request rejected | Source guard present; runtime test pending |
| Office scope | Branch user is not an active Ras Sedr branch account | Fail closed | Source guard present; runtime test pending |
| Office scope | Branch allocation/loading rows belong to another office | Excluded from branch snapshot | Driver/vehicle office predicates present; runtime fixture test pending |
| Load relation | Two load orders share the same factory and quarry | Actual record resolves through booking_id to exactly its linked order | Correct join path present; regression test added/being verified |
| Legacy record | Historical actual record has no booking_id | Explicit reconciliation; never infer an order | Baseline requires booking_id NOT NULL; import policy needed only if legacy imports are added |
| Delivery | Driver tries to confirm another driver's booking | Rejected | Ownership guard present in migration source; runtime test pending |
| Delivery | Delivery already confirmed | No duplicate confirmation/audit entry | Idempotency guard present in migration source; runtime test pending |
| Cancellation | Booking is delivered or has actual delivery recorded | Cancellation rejected | Guard present in migration source; runtime test pending |
| Geofence | GPS is missing, stale, or outside configured radius | No eligible loads shown to driver | Server-side source guard present; runtime test pending |
| Build | TypeScript and production build | Both succeed | Prior CI evidence exists; rerun against this commit |

## Shadow environment gate
The database must be queried directly before applying migrations or claiming runtime acceptance. Reconcile the clean baseline and feature migration history first. Do not seed real operational records or credentials merely to make tests pass.

## Production safety
No production schema/data changes are authorized by this checklist. Any later rollout requires successful Shadow checks and separate approval.
