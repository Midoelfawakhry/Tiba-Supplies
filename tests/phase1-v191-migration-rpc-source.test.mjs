import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = (name) => readFileSync(
  new URL(`../supabase/migrations/${name}`, import.meta.url),
  'utf8',
);

const baseline = migration('20261014190000_phase1_clean_baseline.sql');
const mainOffice = migration('20261014200000_phase1_main_office_rpcs.sql');
const directAssignment = migration('20261015173000_phase1_direct_assignment_acceptance.sql');
const locationArrival = migration('20261014240000_phase1_driver_location_and_arrival.sql');
const driverSnapshot = migration('20261014290000_phase1_driver_portal_snapshot.sql');
const delivery = migration('20261015120000_phase1_actual_weight_and_account_rpcs.sql');
const queue = migration('20261015180000_phase1_queue_selection_and_atomic_dispatch.sql');
const queueHardening = migration('20261015181000_phase1_queue_ui_and_concurrency_hardening.sql');
const queueNotifications = migration('20261015182000_phase1_queue_driver_notifications.sql');
const queueVehicleCompatibility = migration('20261015184000_phase1_queue_vehicle_compatibility.sql');

const chain = [
  baseline, mainOffice, directAssignment, locationArrival, driverSnapshot,
  delivery, queue, queueHardening, queueNotifications, queueVehicleCompatibility,
].join('\n');

test('reviewed migration source defines every v191 driver RPC name', () => {
  for (const name of [
    'driver_get_pending_assignments',
    'driver_get_dispatch_state',
    'driver_get_portal_snapshot',
    'driver_select_load',
    'driver_confirm_delivery',
    'accept_direct_assignment',
    'driver_update_live_location',
    'driver_confirm_arrival',
    'driver_check_in_queue',
  ]) {
    assert.match(
      chain,
      new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, 'i'),
      `reviewed migration chain does not define public.${name}`,
    );
  }
});

test('clean baseline remains schema-only; RPCs come from later migrations', () => {
  assert.doesNotMatch(baseline, /create\\s+(?:or\\s+replace\\s+)?function\\s+public\\./i);
  assert.match(queue, /create table if not exists public\\.dispatch_windows/i);
  assert.match(queue, /create table if not exists public\\.waiting_list_entries/i);
  assert.match(queue, /create table if not exists public\\.driver_load_choices/i);
});

test('v191 named-argument signatures remain available in migration source', () => {
  assert.match(delivery, /create\\s+or\\s+replace\\s+function\\s+public\\.driver_confirm_delivery\\s*\\([\\s\\S]*?p_booking_id\\s+uuid[\\s\\S]*?p_latitude\\s+double precision[\\s\\S]*?p_longitude\\s+double precision[\\s\\S]*?p_accuracy_m\\s+double precision[\\s\\S]*?p_captured_at\\s+timestamptz[\\s\\S]*?p_actual_weight\\s+numeric[\\s\\S]*?p_scale_image_path\\s+text[\\s\\S]*?p_notes\\s+text/i);
  assert.match(locationArrival, /create\\s+or\\s+replace\\s+function\\s+public\\.driver_update_live_location\\s*\\(\\s*p_latitude\\s+double precision\\s*,\\s*p_longitude\\s+double precision\\s*,\\s*p_accuracy_m\\s+double precision\\s*,\\s*p_captured_at\\s+timestamptz/i);
  assert.match(locationArrival, /create\\s+or\\s+replace\\s+function\\s+public\\.driver_confirm_arrival\\s*\\(\\s*p_booking_id\\s+uuid\\s*,\\s*p_latitude\\s+double precision\\s*,\\s*p_longitude\\s+double precision\\s*,\\s*p_accuracy_m\\s+double precision\\s*,\\s*p_captured_at\\s+timestamptz/i);
  assert.match(queue, /create\\s+or\\s+replace\\s+function\\s+public\\.driver_select_load\\s*\\(\\s*p_load_order_id\\s+uuid/i);
  assert.match(queueVehicleCompatibility, /create\\s+or\\s+replace\\s+function\\s+public\\.driver_check_in_queue\\s*\\(\\s*p_latitude\\s+double precision\\s*,\\s*p_longitude\\s+double precision\\s*,\\s*p_accuracy_m\\s+double precision\\s*,\\s*p_captured_at\\s+timestamptz/i);
  assert.match(directAssignment, /create\\s+or\\s+replace\\s+function\\s+public\\.accept_direct_assignment\\s*\\(\\s*p_booking_id\\s+uuid/i);
});

test('queue schema is introduced before queue RPC revisions reference it', () => {
  assert.ok(queue.indexOf('create table if not exists public.dispatch_windows') < queue.indexOf('create or replace function public.driver_check_in_queue'));
  assert.ok(queue.indexOf('create table if not exists public.waiting_list_entries') < queue.indexOf('create or replace function public.driver_check_in_queue'));
  assert.ok(queue.indexOf('create table if not exists public.driver_load_choices') < queue.indexOf('create or replace function public.driver_select_load'));
  assert.match(queueHardening, /create or replace function public\\.main_office_publish_load_order/i);
  assert.match(queueNotifications, /create or replace function public\\.driver_get_dispatch_state/i);
});
