# Tiba v191 Contract Gap — Delivery and Actual Loading (2026-10-17)

Branch: `shadow/phase1-hardening`
Scope: static source comparison of the v191 client and versioned clean-chain SQL. No live database writes.

## Confirmed delivery RPC mismatch

### Client contract

In `src/components/DriverApp.tsx`, the v191 client calls `driver_confirm_delivery` with named parameters:
- `p_booking_id`
- `p_latitude`
- `p_longitude`
- `p_accuracy_m`
- `p_captured_at`
- `p_actual_weight`
- `p_scale_image_path`
- `p_notes`

The client then requires `data.confirmed` to be truthy.

### Current clean-chain definition

Migration `supabase/migrations/20261014300000_phase1_harden_driver_delivery_confirmation.sql` defines the function with only six parameters:
`(p_booking_id uuid, p_latitude double precision, p_longitude double precision, p_accuracy_m double precision, p_captured_at timestamptz, p_notes text default null)`.

It validates auth, GPS accuracy/freshness and booking ownership, inserts a row in `delivery_confirmations`, audits the confirmation, and returns `booking_id`, `confirmed`, and `confirmed_at`. It does **not** accept or persist `p_actual_weight` or `p_scale_image_path`, and it does not return `actual_weight`.

**Result:** PostgREST named-argument invocation from the v191 client is incompatible with this SQL signature. The current contract gate's eight-argument check should fail against this clean-chain definition. The CI currently does not run that standalone contract gate, so the green chain smoke is not proof of delivery-contract compatibility.

## Confirmed actual-loading model gap

The clean baseline `20261014190000_phase1_clean_baseline.sql` defines:
- `actual_loading_records.booking_id NOT NULL UNIQUE`
- `actual_loading_records.recorded_by NOT NULL REFERENCES app_users`
- `actual_weight`, `ticket_number`, `scale_image_path`, `loaded_at`, and `notes`

This model only supports one actual-loading row tied to a booking and recorded by an office app user. It cannot directly represent a paper-based actual-loading entry with no booking and a driver/vehicle/factory/quarry/load date as the primary facts. Production's observed `actual_loading_records` model allows `booking_id` to be null and carries separate loading-date and operational identity fields; do not treat the clean baseline as production-equivalent.

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
