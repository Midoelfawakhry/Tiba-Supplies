# Tiba v191 Contract Gap — Delivery and Actual Loading (2026-10-17)

Branch: `shadow/phase1-hardening`

Scope: static source review and review-branch candidate migration. No live database writes.

## 1. Confirmed v191 client contract

In `src/components/DriverApp.tsx`, the driver calls `driver_confirm_delivery` with eight named parameters:
- `p_booking_id`
- `p_latitude`
- `p_longitude`
- `p_accuracy_m`
- `p_captured_at`
- `p_actual_weight`
- `p_scale_image_path`
- `p_notes`

The client requires `data.confirmed` and displays `data.actual_weight`.

## 2. Corrected RPC signature finding

The older migration `20261014300000_phase1_harden_driver_delivery_confirmation.sql` defines a six-argument intermediate function, but later migrations `20261015120000_phase1_actual_weight_and_account_rpcs.sql` and `20261015120001_phase1_actual_weight_idempotency.sql` supersede it with the eight-argument contract. Therefore the final versioned chain's delivery signature is compatible with v191. The initial review that stopped at the intermediate migration was incomplete; this is corrected here.

## 3. Actual defect: the weight was written at the wrong lifecycle stage

`20261015173000_phase1_direct_assignment_acceptance.sql` replaces `main_office_advance_booking` and records `actual_loading_records` when the office transitions a booking from `LOADING` to `LOADED`. It requires a weight at that stage. The delivery RPC later treats the same row as the actual weight and rejects a different value with `ACTUAL_WEIGHT_ALREADY_RECORDED`.

The established operational rule is:
- Assignment/direct assignment belongs in loading data.
- The actual weight and scale evidence are recorded when the vehicle delivers to the factory.
- Delivery confirmation is atomic with the actual-weight record and must remain idempotent.
- Standalone paper actual-loading records may exist without a booking and need their own date/vehicle/driver/factory/quarry/trip identifiers.

## 4. Review-branch migration prepared

Candidate: [`20261017100000_phase1_separate_loading_data_from_actual_delivery.sql`](https://github.com/Midoelfawakhry/Tiba-Supplies/blob/shadow/phase1-hardening/supabase/migrations/20261017100000_phase1_separate_loading_data_from_actual_delivery.sql)

It:
1. Adds `loading_data_records`, synced from booking assignment and lifecycle, without treating assignment as actual weight.
2. Allows `actual_loading_records.booking_id` to be null for standalone paper records while retaining uniqueness when a booking is present.
3. Adds the paper/actual record fields: load date, vehicle, driver, quarry, factory, trip code, daily load number, loading sequence date, actual-weight timestamp, and record source.
4. Removes actual-weight insertion from the office `LOADED` transition and rejects the old office-side weight/ticket input at that stage.
5. Replaces the eight-argument delivery RPC so it validates identity, ownership, lifecycle, GPS timestamp/accuracy, weight and image-path constraints; records weight and evidence in one transaction; preserves idempotency; and returns `confirmed` and `actual_weight`.
6. Updates owner and account-statement reporting RPCs to include standalone paper records.

This is a **candidate migration on the review branch**, not an applied or production-approved migration.

## 5. Tests and remaining validation

The review branch also updates:
- `tests/phase1-current-lifecycle.test.mjs` to assert that `LOADED` does not write actual weight.
- `tests/phase1-v191-migration-rpc-source.test.mjs` to include the new migration.
- `supabase/tests/phase1_v191_contract_gate.sql` to assert the separate loading-data and standalone actual-record columns.
- `.github/workflows/phase1-shadow-ci.yml` to run the SQL contract gate after replaying the versioned migrations on disposable PostgreSQL.

**Do not mark the migration validated until the latest CI runs complete successfully.** Required next checks are:
1. PostgreSQL clean-chain replay including the new migration.
2. The SQL v191 contract gate, including named-argument signatures and required columns.
3. All app contract tests and TypeScript/build checks.
4. Review any migration-integrity workflow findings and verify that non-standard legacy migration gaps remain documented.
5. Only after clean tests, plan a separate live Shadow apply and authenticated end-to-end test; never apply this candidate to Production as part of this work.

## Evidence links

- [v191 driver client](https://github.com/Midoelfawakhry/Tiba-Supplies/blob/shadow/phase1-hardening/src/components/DriverApp.tsx)
- [Eight-argument delivery implementation before the new lifecycle correction](https://github.com/Midoelfawakhry/Tiba-Supplies/blob/shadow/phase1-hardening/supabase/migrations/20261015120001_phase1_actual_weight_idempotency.sql)
- [Clean baseline](https://github.com/Midoelfawakhry/Tiba-Supplies/blob/shadow/phase1-hardening/supabase/migrations/20261014190000_phase1_clean_baseline.sql)
- [SQL contract gate](https://github.com/Midoelfawakhry/Tiba-Supplies/blob/shadow/phase1-hardening/supabase/tests/phase1_v191_contract_gate.sql)
- [CI workflow](https://github.com/Midoelfawakhry/Tiba-Supplies/blob/shadow/phase1-hardening/.github/workflows/phase1-shadow-ci.yml)
