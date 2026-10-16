import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [
  mainOfficeAuth,
  directAssign,
  branchSnapshot,
  driverPortal,
  delivery,
  directAcceptance,
  dispatchState,
] = await Promise.all([
  read("../supabase/migrations/20261014200000_phase1_main_office_rpcs.sql"),
  read("../supabase/migrations/20261014430000_phase1_enforce_assigned_vehicle_on_booking.sql"),
  read("../supabase/migrations/20261014280000_phase1_branch_read_only_snapshot.sql"),
  read("../supabase/migrations/20261014290000_phase1_driver_portal_snapshot.sql"),
  read("../supabase/migrations/20261015120000_phase1_actual_weight_and_account_rpcs.sql"),
  read("../supabase/migrations/20261015173000_phase1_direct_assignment_acceptance.sql"),
  read("../supabase/migrations/20261015182000_phase1_queue_driver_notifications.sql"),
]);

function body(source, functionName) {
  const start = source.toLowerCase().indexOf(`create or replace function public.${functionName.toLowerCase()}`);
  assert.notEqual(start, -1, `missing definition for ${functionName}`);
  const next = source.toLowerCase().indexOf("create or replace function public.", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test("Main Office write RPCs derive the actor from an active Head Office identity", () => {
  assert.match(mainOfficeAuth, /function public\.current_main_office_user\(\)/i);
  assert.match(mainOfficeAuth, /auth\.uid\(\)/i);
  assert.match(mainOfficeAuth, /au\.is_active=true/i);
  assert.match(mainOfficeAuth, /au\.role in \('ADMIN','HEAD_OFFICE'\)/i);
  assert.match(mainOfficeAuth, /o\.office_code='MAIN'/i);
  assert.match(body(directAssign, "main_office_direct_assign"), /public\.current_main_office_user\(\)/i);
  assert.match(body(directAssign, "main_office_direct_assign"), /DRIVER_OR_VEHICLE_NOT_ASSIGNED_TO_RAS_SEDR/);
});

test("Branch snapshot requires an active Branch account scoped to Ras Sedr", () => {
  assert.match(branchSnapshot, /function public\.current_ras_sedr_branch_user\(\)/i);
  assert.match(branchSnapshot, /au\.auth_user_id=auth\.uid\(\)/i);
  assert.match(branchSnapshot, /au\.is_active=true/i);
  assert.match(branchSnapshot, /au\.role='BRANCH'/i);
  assert.match(branchSnapshot, /o\.office_code='RAS_SEDR'/i);
  assert.match(body(branchSnapshot, "branch_get_snapshot"), /public\.current_ras_sedr_branch_user\(\)/i);
});

test("Driver portal and dispatch state only return data for the authenticated active driver", () => {
  const portal = body(driverPortal, "driver_get_portal_snapshot");
  const dispatch = body(dispatchState, "driver_get_dispatch_state");
  for (const fn of [portal, dispatch]) {
    assert.match(fn, /auth\.uid\(\)/i);
    assert.match(fn, /auth_user_id=auth\.uid\(\)/i);
    assert.match(fn, /is_active=true/i);
    assert.match(fn, /DRIVER_NOT_FOUND/);
  }
  assert.match(portal, /v_fresh and v_distance<=v_office\.geofence_radius_m/i);
  assert.match(portal, /'available_loads',case when v_inside then/i);
  assert.match(dispatch, /n\.recipient_driver_id=v_driver\.driver_id/i);
});

test("Delivery confirmation checks driver ownership and active trip state before writing actual weight", () => {
  const fn = body(delivery, "driver_confirm_delivery");
  assert.match(fn, /auth\.uid\(\)/i);
  assert.match(fn, /where auth_user_id=auth\.uid\(\) and is_active=true/i);
  assert.match(fn, /where booking_id=p_booking_id and driver_id=v_driver\.driver_id for update/i);
  assert.match(fn, /BOOKING_NOT_YOURS/);
  assert.match(fn, /v_booking\.status <> 'IN_TRANSIT'/i);
  assert.match(fn, /POSITIVE_ACTUAL_WEIGHT_REQUIRED/);
  assert.match(fn, /on conflict\(booking_id\) do nothing/i);
});

test("Direct assignment acceptance cannot be used to accept another driver's trip", () => {
  const fn = body(directAcceptance, "accept_direct_assignment");
  assert.match(fn, /auth\.uid\(\)/i);
  assert.match(fn, /where auth_user_id=auth\.uid\(\) and is_active=true/i);
  assert.match(fn, /where booking_id=p_booking_id\s+for update/i);
  assert.match(fn, /v_booking\.driver_id <> v_driver_id/i);
  assert.match(fn, /BOOKING_NOT_YOURS/);
  assert.match(fn, /v_booking\.direct_acceptance_status <> 'PENDING'/i);
});

test("Queue dispatch state requires a valid driver and scopes notifications to that driver", () => {
  const fn = body(dispatchState, "driver_get_dispatch_state");
  assert.match(fn, /auth\.uid\(\)/i);
  assert.match(fn, /where auth_user_id=auth\.uid\(\) and is_active=true/i);
  assert.match(fn, /where driver_id=v_driver\.driver_id and office_id=v_office\.office_id/i);
  assert.match(fn, /n\.recipient_driver_id=v_driver\.driver_id/i);
});

const [driverLocation, queueCompatibility, atomicDirectTrip, finalDirectAssign] = await Promise.all([
  read("../supabase/migrations/20261014240000_phase1_driver_location_and_arrival.sql"),
  read("../supabase/migrations/20261015184000_phase1_queue_vehicle_compatibility.sql"),
  read("../supabase/migrations/20261015160000_phase1_atomic_direct_trip.sql"),
  read("../supabase/migrations/20261014430000_phase1_enforce_assigned_vehicle_on_booking.sql"),
]);

test("Driver location writes validate coordinates, timestamp, accuracy, and active driver identity", () => {
  const fn = body(driverLocation, "driver_update_live_location");
  assert.match(fn, /auth\.uid\(\)/i);
  assert.match(fn, /auth_user_id=auth\.uid\(\) and is_active=true/i);
  assert.match(fn, /INVALID_COORDINATES/);
  assert.match(fn, /LOCATION_ACCURACY_TOO_LOW/);
  assert.match(fn, /LOCATION_TIMESTAMP_STALE_OR_INVALID/);
  assert.match(fn, /on conflict\(driver_id\) do update/i);
  assert.match(fn, /where public\.driver_live_locations\.captured_at <= excluded\.captured_at/i);
});

test("Arrival confirmation checks booking ownership and geofence before changing status", () => {
  const fn = body(driverLocation, "driver_confirm_arrival");
  assert.match(fn, /where booking_id=p_booking_id and driver_id=v_driver\.driver_id for update/i);
  assert.match(fn, /BOOKING_NOT_YOURS/);
  assert.match(fn, /v_booking\.status<>'ASSIGNED'/i);
  assert.match(fn, /v_distance_m>v_office\.geofence_radius_m/i);
  assert.ok(fn.indexOf("OUTSIDE_RAS_SEDR_GEOFENCE") < fn.indexOf("update public.bookings set status='ARRIVED'"));
});

test("Queue check-in requires the driver's active linked vehicle and geofence", () => {
  const fn = body(queueCompatibility, "driver_check_in_queue");
  assert.match(fn, /auth_user_id=auth\.uid\(\) and is_active=true/i);
  assert.match(fn, /DRIVER_HAS_ACTIVE_BOOKING/);
  assert.match(fn, /a\.driver_id=v_driver\.driver_id and a\.ended_at is null/i);
  assert.match(fn, /ACTIVE_LINKED_VEHICLE_REQUIRED/);
  assert.match(fn, /OUTSIDE_RAS_SEDR_GEOFENCE/);
  assert.match(fn, /where public\.driver_live_locations\.captured_at<=excluded\.captured_at/i);
});

test("Atomic direct-trip creation checks Main Office authority and blocks active driver or vehicle conflicts", () => {
  const fn = body(atomicDirectTrip, "main_office_create_direct_trip");
  assert.match(fn, /public\.current_main_office_user\(\)/i);
  assert.match(fn, /DRIVER_HAS_ACTIVE_BOOKING/);
  assert.match(fn, /VEHICLE_HAS_ACTIVE_BOOKING/);
  assert.match(fn, /driver_vehicle_assignments/i);
  assert.match(fn, /a\.driver_id=p_driver_id and a\.ended_at is null/i);
});

test("Final direct-assignment RPC verifies the chosen vehicle is the driver's active assignment", () => {
  const fn = body(finalDirectAssign, "main_office_direct_assign");
  assert.match(fn, /public\.current_main_office_user\(\)/i);
  assert.match(fn, /driver_vehicle_assignments/i);
  assert.match(fn, /a\.driver_id=p_driver_id and a\.vehicle_id=p_vehicle_id and a\.ended_at is null/i);
  assert.match(fn, /DRIVER_HAS_ACTIVE_BOOKING/);
  assert.match(fn, /VEHICLE_HAS_ACTIVE_BOOKING/);
});
