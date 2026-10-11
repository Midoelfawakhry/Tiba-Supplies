import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../supabase/functions/create-driver-account/index.ts", import.meta.url),
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
