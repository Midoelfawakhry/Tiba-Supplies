import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [multiDriverMigration, assignmentsMigration, baseline, directoryUi, assignmentGuard, guardFixMigration, retireLegacyMigration, nativeLocation, liveLocations] = await Promise.all([
  read("../supabase/migrations/20261015190000_phase1_multi_driver_per_vehicle.sql"),
  read("../supabase/migrations/20261014370000_phase1_driver_vehicle_assignments.sql"),
  read("../supabase/migrations/20261014190000_phase1_clean_baseline.sql"),
  read("../src/components/OfficeDirectoryScreen.tsx"),
  read("../supabase/migrations/20261014430000_phase1_enforce_assigned_vehicle_on_booking.sql"),
  read("../supabase/migrations/20261016083000_phase1_multi_driver_assignment_guard_fix.sql"),
  read("../supabase/migrations/20261016083502_phase1_retire_legacy_vehicle_rpcs.sql"),
  read("../supabase/functions/driver-native-location/index.ts"),
  read("../supabase/migrations/20261016103000_phase1_branch_directory_availability_guard.sql"),
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

test("create and edit flows permit shared active vehicles without weakening booking guards", () => {
  assert.match(guardFixMigration, /create or replace function public\.main_office_create_driver/i);
  assert.match(guardFixMigration, /create or replace function public\.main_office_update_driver/i);
  assert.doesNotMatch(guardFixMigration, /VEHICLE_ALREADY_ASSIGNED/);
  assert.match(guardFixMigration, /DRIVER_HAS_ACTIVE_BOOKING/);
  assert.match(directoryUi, /\{filteredAvailableVehicles\.map\(\(vehicle: Row\)/);
  assert.doesNotMatch(directoryUi, /filteredAvailableVehicles\.filter\(\(vehicle: Row\) => !vehicle\.assigned_driver_id\)/);
  assert.doesNotMatch(directoryUi, /العربية مرتبطة بسائق آخر/);
  assert.match(directoryUi, /تعارض النقلات الفعلية/);
  assert.match(directoryUi, /DRIVER_HAS_ACTIVE_BOOKING/);
  assert.match(directoryUi, /vehicle\.assigned_drivers\.length > 1/);
});

test("shared vehicles preserve per-driver location tracking", () => {
  assert.match(nativeLocation, /\.eq\("driver_id", driver\.driver_id\)/);
  assert.match(nativeLocation, /\.is\("ended_at", null\)/);
  assert.match(nativeLocation, /\.limit\(1\)\s*\.maybeSingle\(\)/);
  assert.match(liveLocations, /JOIN LATERAL\s*\(\s*SELECT a\.vehicle_id/i);
  assert.match(liveLocations, /WHERE a\.driver_id = d\.driver_id/i);
  assert.match(liveLocations, /ORDER BY a\.assigned_at DESC\s*LIMIT 1/i);
});

test("legacy single-driver RPCs are retired from client roles", () => {
  assert.match(retireLegacyMigration, /public\.get_available_vehicles\(\)/);
  assert.match(retireLegacyMigration, /public\.create_operational_driver\(text,text,uuid,text\)/);
  assert.match(retireLegacyMigration, /public\.create_operational_vehicle\(text,text,text\)/);
  assert.match(retireLegacyMigration, /REVOKE ALL ON FUNCTION .* FROM PUBLIC, anon, authenticated/i);
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
