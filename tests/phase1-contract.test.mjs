import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [baseline, mainOffice, assignmentSql, lifecycle, driverLocation, delivery, deactivationGuard, masterUpdate, directoryNotes, vehicleOwnerSql, ownerDeactivationGuard, branchSql, driverPortal, assignmentUi, driverUi, branchUi, dashboardUi, directoryUi] = await Promise.all([
  read("../supabase/migrations/20261014190000_phase1_clean_baseline.sql"),
  read("../supabase/migrations/20261014200000_phase1_main_office_rpcs.sql"),
  read("../supabase/migrations/20261014210000_phase1_direct_assignment.sql"),
  read("../supabase/migrations/20261014230000_phase1_directory_and_booking_lifecycle.sql"),
  read("../supabase/migrations/20261014240000_phase1_driver_location_and_arrival.sql"),
  read("../supabase/migrations/20261014300000_phase1_harden_driver_delivery_confirmation.sql"),
  read("../supabase/migrations/20261014310000_phase1_guard_active_directory_deactivation.sql"),
  read("../supabase/migrations/20261014320000_phase1_main_office_update_master_directory.sql"),
  read("../supabase/migrations/20261014330000_phase1_directory_include_notes.sql"),
  read("../supabase/migrations/20261014340000_phase1_vehicle_owner_and_vehicle_creation.sql"),
  read("../supabase/migrations/20261014350000_phase1_guard_owner_active_vehicles.sql"),
  read("../supabase/migrations/20261014280000_phase1_branch_read_only_snapshot.sql"),
  read("../supabase/migrations/20261014290000_phase1_driver_portal_snapshot.sql"),
  read("../src/components/DirectLoadAssignmentScreen.tsx"),
  read("../src/components/DriverApp.tsx"),
  read("../src/components/BranchOfficeApp.tsx"),
  read("../src/components/LiveOperationsBoard.tsx"),
  read("../src/components/OfficeDirectoryScreen.tsx"),
]);

test("clean baseline revokes direct client table access and seeds only office reference rows", () => {
  assert.match(baseline, /revoke all on table public\.%I from anon, authenticated/);
  assert.match(baseline, /'MAIN','المكتب الرئيسي','HEAD_OFFICE'/);
  assert.match(baseline, /'RAS_SEDR','مكتب رأس سدر','BRANCH',true,29\.556864,32\.761699,10000/);
  assert.doesNotMatch(baseline, /insert into public\.(factories|quarries|drivers|vehicles|bookings|load_orders)/i);
});

test("Main Office assignment is connected to a published order, driver, and vehicle", () => {
  assert.match(assignmentSql, /main_office_direct_assign/);
  assert.match(assignmentUi, /main_office_direct_assign/);
  assert.match(assignmentUi, /p_load_order_id:\s*orderId/);
  assert.match(assignmentUi, /p_driver_id:\s*driverId/);
  assert.match(assignmentUi, /p_vehicle_id:\s*vehicleId/);
  assert.match(assignmentUi, /o\.status === 'PUBLISHED'/);
});

test("driver portal hides available loads without a fresh in-geofence location", () => {
  assert.match(driverPortal, /interval '10 minutes'/);
  assert.match(driverPortal, /v_distance<=v_office\.geofence_radius_m/);
  assert.match(driverPortal, /'available_loads',case when v_inside then/);
  assert.match(driverUi, /driver_get_portal_snapshot/);
  assert.match(driverUi, /driver_update_live_location/);
  assert.match(driverUi, /driver_confirm_arrival/);
  assert.doesNotMatch(driverUi, /supabase\.rpc\(['"]driver_arrive['"]/);
});

test("delivery confirmation validates ownership, trip state, timestamp, and accuracy", () => {
  assert.match(delivery, /p_accuracy_m double precision/);
  assert.match(delivery, /p_captured_at timestamptz/);
  assert.match(delivery, /p_accuracy_m>100/);
  assert.match(delivery, /interval '10 minutes'/);
  assert.match(delivery, /v_booking\.status<>'IN_TRANSIT'/);
  assert.match(delivery, /where booking_id=p_booking_id and driver_id=v_driver\.driver_id/);
  assert.match(driverUi, /driver_confirm_delivery/);
});

test("branch interface uses only the Phase 1 read-only branch snapshot RPC", () => {
  assert.match(branchSql, /current_ras_sedr_branch_user/);
  assert.match(branchSql, /branch_get_snapshot/);
  assert.match(branchUi, /branch_get_snapshot/);
  assert.doesNotMatch(branchUi, /supabase\.rpc\(['"]get_branch_office_snapshot['"]/);
});

test("operations dashboard uses Phase 1 booking statuses", () => {
  for (const status of ["ASSIGNED", "ARRIVED", "LOADING", "LOADED", "IN_TRANSIT", "DELIVERED", "CANCELLED"]) {
    assert.match(dashboardUi, new RegExp(status));
  }
  assert.doesNotMatch(dashboardUi, /\['BOOKED', 'LOADING_STATEMENT', 'IN_TRANSIT'\]/);
});

test("directory screen reads and mutates through Phase 1 directory RPCs", () => {
  assert.match(directoryUi, /main_office_get_directory/);
  assert.match(directoryUi, /main_office_upsert_directory/);
  assert.match(directoryUi, /main_office_set_directory_active/);
  assert.match(directoryUi, /قائمة الانتظار غير موجودة في نموذج Phase 1 الحالي/);
  assert.match(directoryUi, /إنشاء حساب سائق وربطه بالعربية لم يُنقل بعد/);
  assert.match(directoryUi, /حفظ تعديل العربية أو تغيير مالكها يحتاج RPC Phase 1 مخصصًا/);
});

test("directory deactivation rejects drivers and vehicles with active trips server-side", () => {
  assert.match(deactivationGuard, /DRIVER_HAS_ACTIVE_BOOKING/);
  assert.match(deactivationGuard, /VEHICLE_HAS_ACTIVE_BOOKING/);
  assert.match(deactivationGuard, /status in \('ASSIGNED','ARRIVED','LOADING','LOADED','IN_TRANSIT'\)/);
  assert.match(deactivationGuard, /current_main_office_user\(\)/);
  assert.match(deactivationGuard, /security definer/i);
});

test("factory and quarry master edits use an audited, authorized Phase 1 RPC", () => {
  assert.match(masterUpdate, /main_office_update_master_directory/);
  assert.match(masterUpdate, /current_main_office_user\(\)/);
  assert.match(masterUpdate, /write_audit_event/);
  assert.match(masterUpdate, /security definer/i);
  assert.match(directoryNotes, /'notes',notes/);
  assert.match(directoryUi, /main_office_update_master_directory/);
});

test("vehicle owners are managed separately and vehicle codes are generated server-side", () => {
  assert.match(vehicleOwnerSql, /main_office_create_vehicle_owner/);
  assert.match(vehicleOwnerSql, /main_office_create_vehicle\(/);
  assert.match(vehicleOwnerSql, /'VH-'\|\|lpad\(nextval\('public\.vehicle_code_seq'\)/);
  assert.match(vehicleOwnerSql, /'OW-'\|\|lpad\(nextval\('public\.vehicle_owner_code_seq'\)/);
  assert.match(directoryUi, /key: 'owners', label: 'ملاك العربيات'/);
  assert.match(directoryUi, /main_office_create_vehicle_owner/);
  assert.match(directoryUi, /<AddVehicleForm owners=\{ownerDirectory\}/);
  assert.doesNotMatch(directoryUi, /create_operational_vehicle/);
});

test("owners cannot be deactivated while they still own active vehicles", () => {
  assert.match(ownerDeactivationGuard, /OWNER_HAS_ACTIVE_VEHICLES/);
  assert.match(ownerDeactivationGuard, /from public\.vehicles where owner_id=p_entity_id and is_active=true/);
  assert.match(directoryUi, /main_office_set_directory_active/);
});
