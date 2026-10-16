import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [lifecycle, baseline, assignmentUi] = await Promise.all([
  read("../supabase/migrations/20261015173000_phase1_direct_assignment_acceptance.sql"),
  read("../supabase/migrations/20261014190000_phase1_clean_baseline.sql"),
  read("../src/components/DirectLoadAssignmentScreen.tsx"),
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

test("actual loading is created at LOADED and one booking cannot be counted twice", () => {
  const advance = lifecycle.slice(
    lifecycle.indexOf("create or replace function public.main_office_advance_booking"),
    lifecycle.indexOf("-- Expose the acceptance state/time")
  );
  assert.match(advance, /v_booking\.assignment_type='DIRECT'.*DRIVER_ACCEPTANCE_REQUIRED/s);
  assert.match(advance, /if v_next='LOADED' then[\s\S]*?insert into public\.actual_loading_records/i);
  assert.match(advance, /POSITIVE_ACTUAL_WEIGHT_REQUIRED/);
  assert.match(baseline, /booking_id uuid not null unique references public\.bookings\(booking_id\)/i);
});
