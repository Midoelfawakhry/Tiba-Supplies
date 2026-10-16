import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [lifecycle, baseline, assignmentUi, separation] = await Promise.all([
  read("../supabase/migrations/20261015173000_phase1_direct_assignment_acceptance.sql"),
  read("../supabase/migrations/20261014190000_phase1_clean_baseline.sql"),
  read("../src/components/DirectLoadAssignmentScreen.tsx"),
  read("../supabase/migrations/20261017100000_phase1_separate_loading_data_from_actual_delivery.sql"),
]);

test("direct assignment creates a pending offer without recording actual loading", () => {
  const createTrip = lifecycle.slice(
    lifecycle.indexOf("create or replace function public.main_office_create_direct_trip"),
    lifecycle.indexOf("create or replace function public.driver_get_pending_assignments")
  );
  assert.match(createTrip, /'DIRECT','ASSIGNED',v_trip_code,'PENDING'/);
  assert.match(createTrip, /'acceptance_required',true/);
  assert.doesNotMatch(createTrip, /insert into public\.actual_loading_records/i);
  assert.match(assignmentUi, /main_office_create_direct_trip/);
});

test("driver acceptance is ownership-checked and does not create a loading record", () => {
  const accept = lifecycle.slice(
    lifecycle.indexOf("create or replace function public.accept_direct_assignment"),
    lifecycle.indexOf("-- A pending direct offer cannot advance")
  );
  assert.match(accept, /where auth_user_id=auth\.uid\(\) and is_active=true/);
  assert.match(accept, /for update/i);
  assert.match(accept, /v_booking\.driver_id <> v_driver_id/);
  assert.match(accept, /direct_acceptance_status='ACCEPTED'/);
  assert.doesNotMatch(accept, /insert into public\.actual_loading_records/i);
});

test("LOADED is a workflow state; actual weight is recorded only at factory delivery", () => {
  const advance = separation.slice(
    separation.indexOf("create or replace function public.main_office_advance_booking"),
    separation.indexOf("-- Final delivery is the only current-flow writer of actual weight")
  );
  const delivery = separation.slice(separation.indexOf("create or replace function public.driver_confirm_delivery"));
  assert.match(advance, /DRIVER_ACCEPTANCE_REQUIRED/);
  assert.match(advance, /ACTUAL_WEIGHT_CAPTURED_AT_DELIVERY/);
  assert.doesNotMatch(advance, /insert into public\.actual_loading_records/i);
  assert.match(delivery, /insert into public\.actual_loading_records/i);
  assert.match(delivery, /'DRIVER_DELIVERY'/);
  assert.match(delivery, /p_actual_weight numeric/);
  assert.match(delivery, /v_actual\.record_source = 'LEGACY'/);
  assert.match(delivery, /'previous_actual_weight',v_actual\.actual_weight/);
  assert.match(delivery, /actual_weight_recorded_at=now\(\)/);
  assert.match(baseline, /booking_id uuid not null unique references public\.bookings\(booking_id\)/i);
});

test("assignment loading data is separate and paper actual records can exist without bookings", () => {
  assert.match(separation, /create table if not exists public\.loading_data_records/i);
  assert.match(separation, /create trigger bookings_sync_loading_data/i);
  assert.match(separation, /create table if not exists public\.daily_loading_counters/i);
  assert.match(separation, /create trigger actual_loading_assign_trip_identity/i);
  assert.match(separation, /TRIP_IDENTITY_IS_IMMUTABLE/);
  assert.match(separation, /actual_loading_records_daily_number_unique/);
  assert.match(separation, /alter column trip_code set not null/);
  assert.match(separation, /alter column booking_id drop not null/i);
  assert.match(separation, /record_source in \('DRIVER_DELIVERY','PAPER_IMPORT','OFFICE_CORRECTION','LEGACY'\)/i);
  assert.match(separation, /booking_id is not null\s+or \(load_date is not null and vehicle_id is not null and driver_id is not null/i);
  assert.match(separation, /left join public\.bookings b on b\.booking_id=alr\.booking_id/i);
});


test("updated actual-loading reports retain Main Office scope", () => {
  assert.equal((separation.match(/perform public\.current_main_office_user\(\)/gi) || []).length >= 3, true);
  assert.doesNotMatch(separation, /au\.role in \('ADMIN','HEAD_OFFICE','BRANCH'\)/i);
});
