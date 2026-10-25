import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/utils/libraryHomeState.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { loadLibraryHomePreferences, saveLibraryHomePreferences, loadLibraryHomeQuery, saveLibraryHomeQuery } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};

test("returning to the library preserves search and view; a new session retains only view preferences", () => {
  const local = storage();
  const session = storage();
  saveLibraryHomePreferences({ sort: "name", layout: "list" }, local);
  saveLibraryHomeQuery("星际", session);
  assert.deepEqual(loadLibraryHomePreferences(local), { sort: "name", layout: "list" });
  assert.equal(loadLibraryHomeQuery(session), "星际");
  assert.equal(loadLibraryHomeQuery(storage()), "");
  saveLibraryHomeQuery("", session);
  assert.equal(loadLibraryHomeQuery(session), "");
});

test("invalid or unavailable preference storage does not prevent browsing", () => {
  for (const value of ["{", "null", "[]", '{"layout":"invalid","sort":42}']) {
    assert.deepEqual(loadLibraryHomePreferences({ getItem: () => value }), { sort: "recent", layout: "grid" });
  }
  const unavailable = { getItem() { throw Error("unavailable"); }, setItem() { throw Error("full"); }, removeItem() { throw Error("unavailable"); } };
  assert.deepEqual(loadLibraryHomePreferences(unavailable), { sort: "recent", layout: "grid" });
  assert.equal(loadLibraryHomeQuery(unavailable), "");
  assert.doesNotThrow(() => saveLibraryHomePreferences({ sort: "name", layout: "list" }, unavailable));
  assert.doesNotThrow(() => saveLibraryHomeQuery("星际", unavailable));
  assert.doesNotThrow(() => saveLibraryHomeQuery("", unavailable));
});
