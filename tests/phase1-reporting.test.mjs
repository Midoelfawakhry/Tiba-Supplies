import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [reportingMigration, vehicleReportsUi, accountStatementsUi] = await Promise.all([
  read("../supabase/migrations/20261015180000_phase1_trip_owner_attribution.sql"),
  read("../src/components/VehicleOwnerReportsScreen.tsx"),
  read("../src/components/AccountStatementsScreen.tsx"),
]);

test("trip owner attribution is captured once and legacy rows are not backfilled from current ownership", () => {
  assert.match(reportingMigration, /ADD COLUMN IF NOT EXISTS vehicle_owner_id_snapshot uuid/);
  assert.match(reportingMigration, /ADD COLUMN IF NOT EXISTS vehicle_owner_name_snapshot text/);
  assert.match(reportingMigration, /BEFORE INSERT ON public\.actual_loading_records/);
  assert.match(reportingMigration, /Never overwrite an existing snapshot during later edits/);
  assert.doesNotMatch(reportingMigration, /UPDATE public\.actual_loading_records[\s\S]{0,300}vehicle_owner_id_snapshot\s*=/i);
  assert.match(reportingMigration, /'owner_attribution_status',[\s\S]*?'UNKNOWN_LEGACY'/);
  assert.match(reportingMigration, /'owner_id', alr\.vehicle_owner_id_snapshot/);
  assert.match(reportingMigration, /'vehicle_owner_id', alr\.vehicle_owner_id_snapshot/);
});

test("vehicle and owner report supports trip-level drilldown and shows historical owner attribution", () => {
  assert.match(vehicleReportsUi, /setOwnerVehicle/);
  assert.match(vehicleReportsUi, /owner_attribution_status/);
  assert.match(vehicleReportsUi, /مالك وقت النقلة/);
  assert.match(vehicleReportsUi, /غير معروف تاريخيًا/);
  assert.match(vehicleReportsUi, /tripCode/);
  assert.match(vehicleReportsUi, /factoryFilter/);
  assert.match(vehicleReportsUi, /quarryFilter/);
});

test("factory and quarry statements filter by the owner captured for the trip", () => {
  assert.match(accountStatementsUi, /row\.vehicle_owner_id/);
  assert.match(accountStatementsUi, /setOwnerId/);
  assert.match(accountStatementsUi, /مالك العربية/);
  assert.match(accountStatementsUi, /row\.vehicle_owner_name/);
  assert.match(accountStatementsUi, /غير معروف تاريخيًا/);
});
