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
    assert.ok(
      chain.includes(`function public.${name}(`),
      `reviewed migration chain does not define public.${name}`,
    );
  }
});

test('clean baseline remains schema-only; queue schema is defined by queue migration', () => {
  assert.ok(!baseline.includes('create function public.'));
  assert.ok(!baseline.includes('create or replace function public.'));
  assert.ok(queue.includes('create table if not exists public.dispatch_windows'));
  assert.ok(queue.includes('create table if not exists public.waiting_list_entries'));
  assert.ok(queue.includes('create table if not exists public.driver_load_choices'));
});

test('v191 named-argument signatures remain available in migration source', () => {
  for (const arg of [
    'p_booking_id uuid',
    'p_latitude double precision',
    'p_longitude double precision',
    'p_accuracy_m double precision',
    'p_captured_at timestamptz',
    'p_actual_weight numeric',
    'p_scale_image_path text',
    'p_notes text',
  ]) assert.ok(delivery.includes(arg), `delivery migration missing named arg: ${arg}`);

  assert.ok(locationArrival.includes('function public.driver_update_live_location(p_latitude double precision,p_longitude double precision,p_accuracy_m double precision,p_captured_at timestamptz)'));
  assert.ok(locationArrival.includes('function public.driver_confirm_arrival(p_booking_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy_m double precision,p_captured_at timestamptz)'));
  assert.ok(queue.includes('function public.driver_select_load(') && queue.includes('p_load_order_id uuid'));
  assert.ok(queueVehicleCompatibility.includes('function public.driver_check_in_queue(p_latitude double precision,p_longitude double precision,p_accuracy_m double precision,p_captured_at timestamptz)'));
  assert.ok(directAssignment.includes('function public.accept_direct_assignment(p_booking_id uuid)'));
});

test('queue schema is declared before queue RPCs and later hardening remains present', () => {
  assert.ok(queue.indexOf('create table if not exists public.dispatch_windows') < queue.indexOf('create or replace function public.driver_check_in_queue'));
  assert.ok(queue.indexOf('create table if not exists public.waiting_list_entries') < queue.indexOf('create or replace function public.driver_check_in_queue'));
  assert.ok(queue.indexOf('create table if not exists public.driver_load_choices') < queue.indexOf('create or replace function public.driver_select_load'));
  assert.ok(queueHardening.includes('create or replace function public.main_office_publish_load_order'));
  assert.ok(queueNotifications.includes('create or replace function public.driver_get_dispatch_state'));
  assert.ok(driverSnapshot.includes('create or replace function public.driver_get_portal_snapshot'));
  assert.ok(mainOffice.includes('create or replace function public.current_main_office_user'));
});


const assignmentModel = migration('20261014370000_phase1_driver_vehicle_assignments.sql');
const deliveryIdempotency = migration('20261015120001_phase1_actual_weight_idempotency.sql');
const tripIdentity = migration('20261011125652_20261011190000_direct_assignment_trip_identity.sql');

test('canonical driver-vehicle assignment model is created before queue compatibility code', () => {
  assert.ok(assignmentModel.includes('create table if not exists public.driver_vehicle_assignments'));
  assert.ok(assignmentModel.includes('assigned_at timestamptz'));
  assert.ok(assignmentModel.includes('ended_at timestamptz'));
  assert.ok(!assignmentModel.includes('create table if not exists public.vehicle_driver_assignments'));
  assert.ok(queueVehicleCompatibility.includes('public.driver_vehicle_assignments'));
});

test('v191 schema evolution sources include delivery idempotency and trip identity changes', () => {
  assert.ok(deliveryIdempotency.includes('actual_loading_records'));
  assert.ok(tripIdentity.includes('trip_code'));
  assert.ok(directAssignment.includes('direct_acceptance_status'));
  assert.ok(queue.includes('dispatch_window_id'));
});

test('baseline is not treated as a complete v191 bootstrap by itself', () => {
  assert.ok(!baseline.includes('create table public.driver_vehicle_assignments'));
  assert.ok(!/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.bookings[\s\S]*?trip_code/i.test(baseline));
  assert.ok(!baseline.includes('create table public.dispatch_windows'));
});
