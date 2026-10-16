import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const driverApp = readFileSync(new URL('../src/components/DriverApp.tsx', import.meta.url), 'utf8');

function rpcBlock(name) {
  const marker = `supabase.rpc('${name}'`;
  const start = driverApp.indexOf(marker);
  assert.notEqual(start, -1, `v191 client must keep RPC ${name}`);
  const end = driverApp.indexOf('\n      });', start);
  return driverApp.slice(start, end === -1 ? start + 1600 : end);
}

test('v191 driver RPC names remain stable', () => {
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
    assert.ok(driverApp.includes(`supabase.rpc('${name}'`) ||
      driverApp.includes(`rpc('${name}'`), `missing RPC call: ${name}`);
  }
});

test('v191 delivery call retains all eight named arguments', () => {
  const block = rpcBlock('driver_confirm_delivery');
  for (const arg of [
    'p_booking_id:',
    'p_latitude:',
    'p_longitude:',
    'p_accuracy_m:',
    'p_captured_at:',
    'p_actual_weight:',
    'p_scale_image_path:',
    'p_notes:',
  ]) {
    assert.ok(block.includes(arg), `delivery RPC argument changed or missing: ${arg}`);
  }
});

test('v191 arrival and load selection keep their named argument keys', () => {
  const arrival = rpcBlock('driver_confirm_arrival');
  for (const arg of ['p_booking_id:', 'p_latitude:', 'p_longitude:', 'p_accuracy_m:', 'p_captured_at:']) {
    assert.ok(arrival.includes(arg), `arrival RPC argument changed or missing: ${arg}`);
  }
  const selection = rpcBlock('driver_select_load');
  assert.ok(selection.includes('p_load_order_id:'), 'load selection argument must remain p_load_order_id');
});

test('v191 native tracking and freshness controls remain present', () => {
  assert.ok(driverApp.includes("registerPlugin<NativeDriverTrackingPlugin>('NativeDriverTracking')"));
  assert.ok(driverApp.includes('MOVING_LOCATION_UPLOAD_INTERVAL_MS'));
  assert.ok(driverApp.includes('MAX_LOCATION_UPLOAD_ACCURACY_METERS'));
  assert.ok(driverApp.includes('driver_update_live_location'));
});
