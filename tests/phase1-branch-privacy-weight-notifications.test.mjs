import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [migration, mainOfficeMigration, liveData, dashboard, driverApp] = await Promise.all([
  readFile(new URL("../supabase/migrations/20261016100000_phase1_branch_privacy_and_weight_notifications.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20261016102000_phase1_main_office_weight_notifications.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/services/liveData.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/LiveOperationsBoard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/DriverApp.tsx", import.meta.url), "utf8"),
]);

test("branch snapshot hides pending direct offers from both loads and allocations", () => {
  assert.match(migration, /NOT EXISTS\s*\(\s*SELECT 1 FROM public\.bookings pending[\s\S]*?pending\.assignment_type='DIRECT'[\s\S]*?pending\.direct_acceptance_status='PENDING'[\s\S]*?pending\.status='ASSIGNED'/i);
  assert.match(migration, /AND NOT \(b\.assignment_type='DIRECT' AND b\.direct_acceptance_status='PENDING' AND b\.status='ASSIGNED'\)/i);
  assert.match(migration, /current_ras_sedr_branch_user\(\)/i);
});

test("actual weight first-record event notifies both Main Office and Ras Sedr once per booking", () => {
  assert.match(migration, /office_code IN \('MAIN','RAS_SEDR'\)/i);
  assert.match(migration, /notification_type='ACTUAL_WEIGHT_CONFIRMED'/i);
  assert.match(migration, /n\.payload->>'booking_id'=NEW\.booking_id::text/i);
  assert.match(migration, /AFTER INSERT OR UPDATE OF actual_weight ON public\.actual_loading_records/i);
  assert.match(migration, /NEW\.actual_weight <= 0/i);
  assert.match(migration, /تم تسجيل وتأكيد الوزن الفعلي للنقلة %s/);
  assert.match(migration, /'actual_weight',NEW\.actual_weight/);
});

test("Main Office dashboard loads and displays office weight notifications", () => {
  assert.match(mainOfficeMigration, /'office_notifications'/i);
  assert.match(mainOfficeMigration, /office_code='MAIN'/i);
  assert.match(liveData, /office_notifications: data\?\.office_notifications \?\? \[\]/);
  assert.match(dashboard, /تنبيهات التشغيل والوزن الفعلي/);
  assert.match(dashboard, /data\?\.office_notifications/);
});

test("driver outcome notifications render outside the geofence-only load selection section", () => {
  assert.match(driverApp, /إشعارات نتيجة التوزيع|إشعارات التوزيع/);
  assert.match(driverApp, /تظهر إشعارات نتيجة التوزيع حتى لو كنت خارج نطاق الـ 10 كم/);
  assert.match(driverApp, /LOAD_REQUEST_NOT_ALLOCATED|notifications\.map/);
});
