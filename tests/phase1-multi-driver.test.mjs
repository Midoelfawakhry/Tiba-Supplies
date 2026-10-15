import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [multiDriverMigration, assignmentsMigration, baseline, directoryUi, assignmentGuard] = await Promise.all([
  read("../supabase/migrations/20261015190000_phase1_multi_driver_per_vehicle.sql"),
  read("../supabase/migrations/20261014370000_phase1_driver_vehicle_assignments.sql"),
  read("../supabase/migrations/20261014190000_phase1_clean_baseline.sql"),
  read("../src/components/OfficeDirectoryScreen.tsx"),
  read("../supabase/migrations/20261014430000_phase1_enforce_assigned_vehicle_on_booking.sql"),
]);

test("a vehicle can have multiple active driver assignments while a driver has only one", () => {
  assert.match(multiDriverMigration, /drop index if exists public\.driver_vehicle_one_active_vehicle/i);
  assert.match(assignmentsMigration, /driver_vehicle_one_active_driver/);
  assert.doesNotMatch(multiDriverMigration, /driver_vehicle_one_active_vehicle\s+on public\.driver_vehicle_assignments/i);
  assert.doesNotMatch(multiDriverMigration, /VEHICLE_ALREADY_ASSIGNED/);
  assert.match(multiDriverMigration, /insert into public\.driver_vehicle_assignments\(driver_id,vehicle_id,assigned_by\)/i);
});

test("vehicle directory returns and displays every currently assigned driver", () => {
  assert.match(multiDriverMigration, /'assigned_drivers',coalesce\(\(select jsonb_agg/i);
  assert.match(multiDriverMigration, /where a\.vehicle_id=v\.vehicle_id and a\.ended_at is null/i);
  assert.match(directoryUi, /assigned_drivers: Array\.isArray\(r\.assigned_drivers\)/);
  assert.match(directoryUi, /row\.assigned_drivers\.map\(\(driver: Row\) => driver\.name\)/);
});

test("multi-driver support does not permit double-booking a vehicle or driver", () => {
  assert.match(baseline, /create unique index bookings_one_active_driver on public\.bookings\(driver_id\)/);
  assert.match(baseline, /create unique index bookings_one_active_vehicle on public\.bookings\(vehicle_id\)/);
  assert.match(assignmentGuard, /DRIVER_HAS_ACTIVE_BOOKING/);
  assert.match(assignmentGuard, /VEHICLE_HAS_ACTIVE_BOOKING/);
  assert.match(assignmentGuard, /VEHICLE_NOT_ASSIGNED_TO_DRIVER/);
});

test("driver reassignment and directory updates remain audited and protected", () => {
  assert.match(multiDriverMigration, /current_main_office_user\(\)/);
  assert.match(multiDriverMigration, /write_audit_event\('REASSIGN_DRIVER_VEHICLE'/);
  assert.match(multiDriverMigration, /write_audit_event\('ASSIGN_DRIVER_VEHICLE'/);
  assert.match(multiDriverMigration, /revoke all on function public\.main_office_create_driver\(text,text,text,uuid\) from public,anon,authenticated/i);
  assert.match(multiDriverMigration, /grant execute on function public\.main_office_create_driver\(text,text,text,uuid\) to authenticated/i);
});
