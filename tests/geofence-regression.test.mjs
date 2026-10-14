import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const geofence = await readFile(new URL("../supabase/migrations/20261011003819_driver_geofence_status_helper.sql", import.meta.url), "utf8");
const captured = await readFile(new URL("../supabase/migrations/20261011004304_validate_captured_driver_location_time.sql", import.meta.url), "utf8");
const assignment = await readFile(new URL("../supabase/migrations/20261012104135_auto_assign_drivers_to_ras_sedr.sql", import.meta.url), "utf8");

test("geofence uses configured radius", () => {
  assert.match(geofence, /office_type\s*=\s*'BRANCH'/i);
  assert.match(geofence, /geofence_radius_m/);
  assert.match(geofence, /v_distance_m\s*<=\s*COALESCE\(v_office\.geofence_radius_m,\s*10000\)/);
});

test("geofence rejects missing and stale locations", () => {
  assert.match(geofence, /LOCATION_MISSING_OR_STALE/);
  assert.match(geofence, /updated_at\s*<\s*now\(\)\s*-\s*interval\s*'10 minutes'/i);
});

test("captured time rejects stale or future timestamps", () => {
  assert.match(captured, /LOCATION_CAPTURE_TIME_INVALID_OR_STALE/);
  assert.match(captured, /captured_at/);
  assert.match(captured, /interval ''1 minute''/);
});

test("driver office assignment preserves existing active assignment", () => {
  assert.match(assignment, /IF NOT EXISTS[\s\S]*?driver_office_assignments[\s\S]*?assigned_to IS NULL/i);
  assert.match(assignment, /ACTIVE_RAS_SEDR_OFFICE_NOT_FOUND/);
});
