# Tiba-Supplies v191 — Booking Lifecycle & Acceptance Test Matrix

Date: 2026-10-16
Branch: `shadow/phase1-hardening`
Authority: current v191 client calls plus inspected clean-baseline and historical SQL sources.
Status: test specification only; no executable migration and no database writes.

## Lifecycle that v191 visibly relies on

| Action | Expected precondition | Expected result | Required negative test |
|---|---|---|---|
| Driver checks into queue | Authenticated active driver; current GPS captured time and accuracy valid; inside Ras Sedr geofence; active vehicle assignment | Driver appears in eligible waiting list | Reject stale/future GPS, inaccurate GPS, outside radius, inactive driver, missing vehicle assignment |
| Driver selects load | Driver is in waiting queue; selection window open; load order published and has capacity; driver and vehicle have no active booking | Return `choice_id`, `status='CHOSEN'`, `selection_ends_at` | Reject not queued, closed window, full load, outside geofence, stale GPS, active driver/vehicle booking |
| Queue finalization | Selection window expired; eligible choices still valid; office authorization/ownership valid | Atomic assignment; one active booking per driver and vehicle | Concurrent finalizers do not double-assign; cancelled/inactive/expired candidates are skipped |
| Direct assignment | Authenticated HEAD/ADMIN operator; load/driver/vehicle eligible | Pending direct offer; no loading record before driver acceptance | Branch cannot perform operational write; duplicate or conflicting active assignment rejected |
| Driver accepts direct assignment | Authenticated assigned driver; offer still pending; no conflicting active booking | Return `accepted=true`, `acceptance_status='ACCEPTED'`, `accepted_at`; preserve trip code if supplied | Another driver cannot accept; repeat acceptance is idempotent or returns documented conflict; no duplicate loading record |
| Driver confirms arrival | Driver owns active booking; captured GPS valid and inside required geofence | Booking moves to arrival state and returns documented success | Wrong driver, invalid accuracy, stale/future timestamp, outside geofence, wrong booking status |
| Driver confirms delivery/loading evidence | Driver owns eligible booking; positive weight; current GPS; optional image already uploaded to permitted bucket | Return JSON with `confirmed=true` and `actual_weight`; atomic status/record updates | Wrong owner, wrong status, zero/negative weight, duplicate record, invalid GPS, storage path belonging to another booking |
| Native location update | Authenticated active driver session; valid coordinates, accuracy and captured timestamp; active vehicle assignment resolved consistently | Latest valid location saved; older captured fixes cannot overwrite newer accepted fixes | Reject inactive driver, poor accuracy, stale/future time, unauthorized user; verify native and foreground calls use same RPC contract |

## Status policy: unresolved mapping, do not guess

The clean baseline allows booking statuses:
`ASSIGNED → ARRIVED → LOADING → LOADED → IN_TRANSIT → DELIVERED`, with cancellation represented by `CANCELLED` where permitted.

Historical sources also use `BOOKED` and `LOADING_STATEMENT`, and the queue finalizer refers to `direct_acceptance_status`. Those are not part of the clean baseline. Before implementation, decide whether:
- `BOOKED` maps to `ASSIGNED` and `LOADING_STATEMENT` maps to a distinct lifecycle field; or
- the lifecycle is explicitly redesigned while retaining v191's externally observed behavior.

Do not silently translate statuses in SQL. Every transition must define who may execute it, its source/target state, required evidence, and whether it creates an actual-loading record.

## Atomicity and idempotency requirements

1. A successful assignment must atomically claim the driver and vehicle, create the booking, and record the audit event.
2. Driver acceptance must not create a second active booking or duplicate actual-loading row on retries.
3. Delivery confirmation must atomically validate booking ownership/status, captured location, positive weight, and duplicate constraints before committing status and evidence.
4. GPS freshness must use the client-captured timestamp, validate it against server time, and prevent an older fix from replacing a newer accepted fix.
5. Geofence eligibility for queue/load selection is distinct from visibility of an already assigned booking; preserve the historical rule that assigned bookings remain visible outside the queue geofence unless the pinned v191 source proves otherwise.
6. Main office is the operational write authority. Ras Sedr remains the geofence/check-in reference; branch users must not gain load creation, assignment, cancellation, or routing write authority.
7. Storage policy for `scale-tickets` must bind uploaded paths to the authenticated driver's own booking; never treat a client-supplied path as proof of ownership.

## Test execution order

- [ ] Pin exact source SHA of the signed v191 release; record versionCode/versionName and build artifact checksum.
- [ ] Extract RPC invocations from that exact source, including every named argument and native HTTP call.
- [ ] Resolve the canonical driver/vehicle assignment model and status mapping.
- [ ] Build a clean PostgreSQL database from only the proposed clean migration chain.
- [ ] Assert required relations, columns, constraints, indexes, triggers, RLS policies, grants, RPC signatures, and return JSON keys through catalog queries.
- [ ] Run each positive and negative test with isolated Auth users for ADMIN, HEAD_OFFICE, driver, and branch-read-only roles.
- [ ] Run concurrent selection/finalization/acceptance attempts and verify no duplicate active driver/vehicle assignment.
- [ ] Run foreground and native background location calls against the same test RPC.
- [ ] Run delivery with and without scale image; test path ownership and duplicate submission.
- [ ] Only after all gates pass, initialize the dedicated Shadow database and run a test-only Android build against Shadow.

## Release gate
No changes to the v191 app, AI assistant, native location behavior, or signed-release workflow are authorized by this specification. No Shadow or Production database writes are performed by this document. Production remains blocked until the full clean-install and authenticated behavior matrix passes.
