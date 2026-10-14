import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../supabase/functions/create-driver-account/index.ts", import.meta.url),
  "utf8",
);

const branchSource = await readFile(
  new URL("../supabase/functions/create-branch-employee/index.ts", import.meta.url),
  "utf8",
);

const trackingSource = await readFile(
  new URL("../supabase/functions/driver-native-location/index.ts", import.meta.url),
  "utf8",
);
const trackingMigration = await readFile(
  new URL("../supabase/migrations/20261014_native_driver_tracking_sessions.sql", import.meta.url),
  "utf8",
);

const aiFunctionSource = await readFile(
  new URL("../supabase/functions/tiba-ai-assistant/index.ts", import.meta.url),
  "utf8",
);
const aiUiSource = await readFile(
  new URL("../src/components/SystemAiAssistant.tsx", import.meta.url),
  "utf8",
);
const officeUiSource = await readFile(
  new URL("../src/components/LiveOperationsBoard.tsx", import.meta.url),
  "utf8",
);
const branchUiSource = await readFile(
  new URL("../src/components/BranchOfficeApp.tsx", import.meta.url),
  "utf8",
);

test("driver account creation is restricted to ADMIN and HEAD_OFFICE", () => {
  const match = source.match(
    /const allowed = \(roleLinks \?\? \[\]\)\.some\(\(link: any\) =>\s*\[([^\]]+)\]\.includes\(link\.roles\?\.name\)\s*\);/s,
  );
  assert.ok(match, "Explicit role allow-list must exist in the account-creation path");

  const roles = [...match[1].matchAll(/["']([^"']+)["']/g)]
    .map((role) => role[1])
    .sort();

  assert.deepEqual(roles, ["ADMIN", "HEAD_OFFICE"]);
  assert.ok(!roles.includes("BRANCH"), "BRANCH is a monitoring-only role");
});

test("the function validates the caller token with Supabase Auth", () => {
  assert.match(source, /callerClient\.auth\.getUser\(token\)/);
  assert.match(source, /if \(callerError \|\| !callerData\.user\)/);
});

test("office caller must have an active app profile before role authorization", () => {
  assert.match(source, /\.from\("app_users"\)[\s\S]*?\.eq\("auth_user_id", callerId\)[\s\S]*?\.eq\("is_active", true\)/);
  assert.match(source, /if \(!appUser\) return json\(\{ error: "INSUFFICIENT_ROLE" \}, 403\)/);
});

test("password setup is limited to an active driver linked to the authenticated user", () => {
  const setupStart = source.indexOf('if (body.action === "complete_password_setup")');
  const createStart = source.indexOf('const { data: appUser', setupStart);
  assert.ok(setupStart >= 0 && createStart > setupStart, "Password setup and office creation paths must remain separate");
  const setup = source.slice(setupStart, createStart);
  assert.match(setup, /\.from\("drivers"\)/);
  assert.match(setup, /\.eq\("auth_user_id", callerId\)/);
  assert.match(setup, /\.eq\("is_active", true\)/);
});

test("branch employee creation is restricted to ADMIN and HEAD_OFFICE", () => {
  const roleGuard = branchSource.match(
    /\[\s*"ADMIN"\s*,\s*"HEAD_OFFICE"\s*\]\.includes\(item\.roles\?\.name\)/,
  );
  assert.ok(roleGuard, "Branch employee creation must allow only ADMIN and HEAD_OFFICE");
  assert.doesNotMatch(
    branchSource,
    /\[\s*"ADMIN"\s*,\s*"HEAD_OFFICE"\s*,\s*"BRANCH"\s*\]\.includes/,
    "BRANCH must not create additional branch accounts",
  );
});

test("branch employee creation validates identity, credentials, and exactly one active branch office", () => {
  assert.match(branchSource, /callerClient\.auth\.getUser\(token\)/);
  assert.match(branchSource, /\.eq\("is_active", true\)/);
  assert.match(branchSource, /password\.length < 10/);
  assert.match(branchSource, /\^\[a-z0-9\]\[a-z0-9\._-\]\{2,29\}\$/);
  assert.match(branchSource, /EXPECTED_ONE_ACTIVE_BRANCH_OFFICE/);
  assert.match(branchSource, /username \+ "@tiba-supplies\.invalid"/);
  assert.match(branchSource, /app_metadata: \{ app_role: "BRANCH" \}/);
});

test("Tiba AI assistant requires an authenticated active profile and checks role per interface", () => {
  assert.match(aiFunctionSource, /callerClient\.auth\.getUser\(token\)/);
  assert.match(aiFunctionSource, /\.from\("app_users"\)[\s\S]*?\.eq\("is_active", true\)/);
  assert.match(aiFunctionSource, /audience === "HEAD_OFFICE"[\s\S]*?\["ADMIN", "HEAD_OFFICE"\]/);
  assert.match(aiFunctionSource, /audience === "BRANCH"[\s\S]*?roles\.includes\("BRANCH"\)/);
  assert.match(aiFunctionSource, /\.eq\("office_id", profile\.office_id\)[\s\S]*?\.eq\("office_type", "BRANCH"\)[\s\S]*?\.eq\("is_active", true\)/);
  assert.match(aiFunctionSource, /GEMINI_API_KEY/);
  assert.match(aiFunctionSource, /contextText\.length > 12000/);
  assert.match(aiFunctionSource, /question\.length > 1200/);
});

test("AI key stays server-side and assistant is advisory-only", () => {
  assert.match(aiFunctionSource, /Deno\.env\.get\("GEMINI_API_KEY"\)/);
  assert.doesNotMatch(aiUiSource, /GEMINI_API_KEY|generativelanguage\.googleapis\.com/);
  assert.match(aiUiSource, /محتاج إعداد مفتاح Gemini الآمن في Supabase/);
  assert.match(aiFunctionSource, /لا تنفذ أي إجراء/);
  assert.match(aiFunctionSource, /لا تقترح تنفيذ تعديلات أو إسناد أو إلغاء من حساب الفرع/);
});

test("both office interfaces expose the shared AI assistant with separate role contexts", () => {
  assert.match(officeUiSource, /SystemAiAssistant audience="HEAD_OFFICE"/);
  assert.match(officeUiSource, /\['assistant', 'مساعد النظام AI', Bot\]/);
  assert.match(branchUiSource, /SystemAiAssistant audience="BRANCH"/);
  assert.match(branchUiSource, /key:'assistant',label:'مساعد النظام AI'/);
});


test("native tracking uses the Phase 1 driver-vehicle assignment and live-location schema", () => {
  assert.match(trackingSource, /\.from\("driver_vehicle_assignments"\)/);
  assert.match(trackingSource, /\.is\("ended_at", null\)/);
  assert.match(trackingSource, /\.lte\("assigned_at", new Date\(\)\.toISOString\(\)\)/);
  assert.match(trackingSource, /\.from\("driver_live_locations"\)\.upsert\([\s\S]*?accuracy_m: accuracy,[\s\S]*?captured_at:[\s\S]*?received_at:/);
  assert.doesNotMatch(trackingSource, /vehicle_driver_assignments|assigned_to|assigned_from|vehicle_id: assignment\.vehicle_id|speed_kmh:|heading,/);
  assert.match(trackingMigration, /driver_location_tracking_sessions/);
  assert.match(trackingMigration, /REVOKE ALL ON public\.driver_location_tracking_sessions FROM PUBLIC, anon, authenticated/);
});
