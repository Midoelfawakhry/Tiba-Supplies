import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20261016101000_phase1_dispatch_outcome_notifications.sql", import.meta.url),
  "utf8",
);

test("every non-allocated selection persists a truthful reason and emits one driver notification", () => {
  assert.match(migration, /outcome_reason text/i);
  assert.match(migration, /WHERE choice_id=p_choice_id AND status='CHOSEN'/i);
  assert.match(migration, /SET status='NOT_ALLOCATED', outcome_reason=p_reason/i);
  assert.match(migration, /'LOAD_REQUEST_NOT_ALLOCATED'/i);
  assert.match(migration, /'QUANTITY_FILLED'/i);
  assert.match(migration, /'LOCATION_STALE_OR_INACCURATE'/i);
  assert.match(migration, /'OUTSIDE_GEOFENCE'/i);
  assert.match(migration, /'DRIVER_OR_VEHICLE_UNAVAILABLE'/i);
  assert.match(migration, /'DRIVER_OR_QUEUE_NO_LONGER_ELIGIBLE'/i);
});

test("winner notification contains factory, quarry, and immutable trip code", () => {
  assert.match(migration, /'LOAD_REQUEST_ACCEPTED'/i);
  assert.match(migration, /برجاء التوجه إلى محجر %s للتحميل لصالح مصنع %s\. كود النقلة: %s/);
  assert.match(migration, /'trip_code',v_trip_code/i);
});

test("driver dispatch state exposes final allocation outcomes to the driver UI", () => {
  assert.match(migration, /'choice_outcome_reason',v_choice\.outcome_reason/i);
  assert.match(migration, /'LOAD_SELECTION_OPEN','LOAD_REQUEST_ACCEPTED','LOAD_REQUEST_NOT_ALLOCATED'/i);
});
