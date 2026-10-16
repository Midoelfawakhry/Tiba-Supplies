import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [migration, screen, board] = await Promise.all([
  read("../supabase/migrations/20261017111000_phase1_paper_actual_load_entry.sql"),
  read("../src/components/PaperLoadingEntryScreen.tsx"),
  read("../src/components/LiveOperationsBoard.tsx"),
]);

test("paper loading entry is Main Office-authorized and writes a paper provenance record", () => {
  assert.match(migration, /perform public\.current_main_office_user\(\)/i);
  assert.match(migration, /record_source,\s*source_record_id,\s*source_file_name,\s*source_row_number,\s*imported_at/i);
  assert.match(migration, /'PAPER_IMPORT'/);
  assert.match(migration, /public\.write_audit_event\('PAPER_ACTUAL_LOAD_RECORDED'/i);
  assert.match(migration, /revoke all on function public\.main_office_record_paper_actual_load/i);
  assert.match(migration, /grant execute on function public\.main_office_record_paper_actual_load.*to authenticated/i);
});

test("paper loading form validates weight and uses the scoped server RPC", () => {
  assert.match(screen, /main_office_record_paper_actual_load/);
  assert.match(screen, /weight <= 0 \|\| weight > 1000/);
  assert.match(screen, /p_source_file_name: null/);
  assert.match(screen, /p_source_row_number: null/);
  assert.match(board, /PaperLoadingEntryScreen/);
  assert.match(board, /activeScreen === 'actual'/);
});
