import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../app/api/properties/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const missionId = "11111111-1111-4111-8111-111111111111";
const otherMissionId = "22222222-2222-4222-8222-222222222222";

function loadDelete(rows, error = null) {
  const filters = [];
  const state = { rows: structuredClone(rows), connections: 0 };
  const query = {
    delete() { return query; },
    eq(column, value) { filters.push([column, value]); return query; },
    select() {
      if (error) return { data: null, error };
      const deleted = state.rows.filter((row) => filters.every(([key, value]) => row[key] === value));
      state.rows = state.rows.filter((row) => !deleted.includes(row));
      return { data: deleted.map(({ id }) => ({ id })), error: null };
    },
  };
  const exports = {};
  runInNewContext(compiled, {
    exports,
    Response,
    require(name) {
      assert.equal(name, "@/lib/supabase");
      return {
        create_supabase_client() {
          state.connections += 1;
          return { from(table) { assert.equal(table, "properties"); return query; } };
        },
      };
    },
  });
  return { remove: exports.DELETE, state };
}

function request(query = "") {
  return { nextUrl: new URL(`http://localhost/api/properties${query}`) };
}

test("clear archive deletes only archived properties in the requested mission", async () => {
  const { remove, state } = loadDelete([
    { id: "archive-a", list_id: missionId, status: "archived" },
    { id: "archive-b", list_id: missionId, status: "archived" },
    { id: "active-null", list_id: missionId, status: null },
    { id: "active-status", list_id: missionId, status: "active" },
    { id: "other-archive", list_id: otherMissionId, status: "archived" },
    { id: "other-active", list_id: otherMissionId, status: null },
  ]);
  const response = await remove(request(`?listId=${missionId}`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, deletedIds: ["archive-a", "archive-b"] });
  assert.deepEqual(state.rows.map(({ id }) => id), ["active-null", "active-status", "other-archive", "other-active"]);
});

for (const query of ["", "?listId=", "?listId=invalid", "?listId=*"]) {
  test(`rejects an absent or invalid mission before connecting: ${query || "no query"}`, async () => {
    const { remove, state } = loadDelete([]);
    const response = await remove(request(query));
    assert.equal(response.status, 400);
    assert.equal(state.connections, 0);
  });
}

test("empty archives return an empty deletion result", async () => {
  const { remove } = loadDelete([]);
  const response = await remove(request(`?listId=${missionId}`));
  assert.deepEqual(await response.json(), { ok: true, deletedIds: [] });
});

test("database failures return an error without reporting a successful deletion", async () => {
  const rows = [{ id: "archive", list_id: missionId, status: "archived" }];
  const { remove, state } = loadDelete(rows, { message: "Database unavailable" });
  const response = await remove(request(`?listId=${missionId}`));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { ok: false, error: "Database unavailable" });
  assert.deepEqual(state.rows, rows);
});
