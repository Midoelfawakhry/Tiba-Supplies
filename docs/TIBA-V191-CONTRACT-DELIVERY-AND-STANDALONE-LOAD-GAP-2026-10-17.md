# Tiba v191 Contract Gap — Delivery and Actual Loading (2026-10-17)

Branch: `shadow/phase1-hardening`
Scope: static source comparison of the v191 client and versioned clean-chain SQL. No live database writes.

## Delivery RPC signature: resolved by a later migration

### Client contract

In `src/components/DriverApp.tsx`, v191 calls `driver_confirm_delivery` with eight named parameters:
- `p_booking_id`
- `p_latitude`
- `p_longitude`
- `p_accuracy_m`
- `p_captured_at`
- `p_actual_weight`
- `p_scale_image_path`
- `p_notes`

The client requires `data.confirmed` and displays `data.actual_weight`.

### Corrected source finding

The earlier migration `20261014300000_phase1_harden_driver_delivery_confirmation.sql` defines a six-argument intermediate function, but it is superseded in the versioned chain by `20261015120000_phase1_actual_weight_and_account_rpcs.sql` and `20261015120001_phase1_actual_weight_idempotency.sql`, both of which define the eight-argument signature and return the required weight/confirmation fields.

Therefore, **the final versioned chain's delivery signature is compatible with the v191 named-argument contract**. The earlier report's signature-mismatch conclusion was incomplete because it stopped at the intermediate migration; this section corrects that finding.

### Actual remaining delivery-flow defect

The later migration `20261015173000_phase1_direct_assignment_acceptance.sql` replaces `main_office_advance_booking` and inserts into `actual_loading_records` when the office moves a booking from `LOADING` to `LOADED`. It requires `p_actual_weight` at that point. The driver delivery RPC then treats that same row as an existing actual-weight record and rejects a different delivery-time weight with `ACTUAL_WEIGHT_ALREADY_RECORDED`.

That conflicts with the established operating rule: assignment/direct assignment belongs in loading data; **actual weight is recorded when the vehicle delivers to the factory**. The fix must remove actual-weight insertion from the office's `LOADED` transition and make the delivery RPC the current-flow writer of actual weight, while preserving ownership, GPS freshness/accuracy, lifecycle, audit, and idempotency checks.

## Safe resolution requirements

Do not fix this by merely adding unused function arguments or by writing weight into `delivery_confirmations`. A correct compatibility migration must, as a single tested contract:
1. Preserve driver authentication, booking ownership, allowed lifecycle state, GPS timestamp and accuracy checks, and idempotency.
2. Validate `p_actual_weight > 0` and persist actual weight and scale image path to the canonical actual-loading record.
3. Return the exact client-required keys, including `confirmed` and `actual_weight`.
4. Define how `recorded_by` is represented for driver-entered loading without incorrectly requiring a head-office `app_users` row.
5. Decide whether a driver delivery confirmation may create the actual-loading record, or whether weight capture and delivery confirmation are separate transactions; enforce atomicity and duplicate prevention accordingly.
6. Add regression tests for first submission, retry/idempotency, invalid weight, missing/invalid image path policy, booking not owned by caller, stale GPS, and already-confirmed delivery.

Separately, decide whether standalone paper records are in scope for this clean Shadow baseline. If yes, model nullable `booking_id` plus the required loading date and vehicle/driver/factory/quarry identifiers and test duplicate/import reconciliation. Do not import production records during bootstrap.

## CI gate recommendation

After the schema contract is deliberately reconciled, add `supabase/tests/phase1_v191_contract_gate.sql` to the disposable PostgreSQL clean-chain job. Until then, keep the mismatch visible as a blocker rather than making the workflow green by weakening the assertion.

## Evidence links

- [v191 driver client](https://github.com/Midoelfawakhry/Tiba-Supplies/blob/shadow/phase1-hardening/src/components/DriverApp.tsx)
- [Current delivery RPC migration](https://github.com/Midoelfawakhry/Tiba-Supplies/blob/shadow/phase1-hardening/supabase/migrations/20261014300000_phase1_harden_driver_delivery_confirmation.sql)
- [Clean baseline](https://github.com/Midoelfawakhry/Tiba-Supplies/blob/shadow/phase1-hardening/supabase/migrations/20261014190000_phase1_clean_baseline.sql)
- [Contract gate test](https://github.com/Midoelfawakhry/Tiba-Supplies/blob/shadow/phase1-hardening/supabase/tests/phase1_v191_contract_gate.sql)


## Lifecycle conflict: who records the actual weight?

The same clean-chain migrations show a second decision that must be made before implementing the eight-argument delivery RPC:
- `20261015173000_phase1_direct_assignment_acceptance.sql` records `actual_loading_records` when the head-office RPC `main_office_advance_booking(..., 'LOADED', p_actual_weight, ...)` transitions a booking from `LOADING` to `LOADED`.
- The v191 driver client supplies `p_actual_weight` and `p_scale_image_path` to `driver_confirm_delivery`, which is called at the delivery-confirmation step after the booking is `IN_TRANSIT`.
- The current six-argument driver delivery RPC writes only `delivery_confirmations`.

These are distinct operational moments. The intended source of truth must say whether the scale weight/ticket is captured at loading by the office, captured by the driver at delivery, or both with an explicit reconciliation rule. Do not automatically insert a second `actual_loading_records` row during delivery: the baseline's unique `booking_id` constraint would reject it, and silently overwriting the earlier weight would corrupt the operational record. If the driver payload represents a final/verified weight rather than loading weight, model that distinction explicitly and test it.
