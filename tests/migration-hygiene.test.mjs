import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const migrationDir = new URL("../supabase/migrations/", import.meta.url);
const migrationNames = (await readdir(migrationDir))
  .filter((name) => name.endsWith(".sql"))
  .sort();

test("migration filenames are unique", () => {
  assert.equal(new Set(migrationNames).size, migrationNames.length);
});

test("every migration filename has a recognizable date prefix", () => {
  for (const name of migrationNames) {
    assert.match(
      name,
      /^\d{8,14}_[a-z0-9][a-z0-9_-]*\.sql$/i,
      `Migration filename needs a stable timestamp and descriptive slug: ${name}`,
    );
  }
});

test("migration files do not contain obvious production project identifiers", async () => {
  const projectRef = "tnlcvwtphbunteifoonc";
  for (const name of migrationNames) {
    const source = await readFile(new URL(name, migrationDir), "utf8");
    assert.ok(
      !source.includes(projectRef),
      `Migration ${name} must not hardcode a production project reference`,
    );
  }
});
