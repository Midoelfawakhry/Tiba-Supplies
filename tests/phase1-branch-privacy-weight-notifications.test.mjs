import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20261016100000_phase1_branch_privacy_and_weight_notifications.sql", import.meta.url),
  "utf8",
);

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
