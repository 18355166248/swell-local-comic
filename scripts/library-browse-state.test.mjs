import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/utils/libraryBrowseState.ts", import.meta.url), "utf8");
const transpile = (input) => ts.transpileModule(input, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const libraryUtilities = transpile(await readFile(new URL("../src/utils/libraryUtils.ts", import.meta.url), "utf8"));
const libraryUtilitiesUrl = `data:text/javascript;base64,${Buffer.from(libraryUtilities).toString("base64")}`;
const output = transpile(source).replace('"./libraryUtils"', JSON.stringify(libraryUtilitiesUrl));
const {
  createLibraryBrowseState, loadLibraryBrowseState, saveLibraryBrowseState,
  reconcileLibraryBrowseState, filterDirectoryTree, getDirectoryBranchPaths,
} = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

const chapter = (path, name = path) => ({ name, path, readable: true, imageCount: 8, children: [] });
const tree = {
  name: "作品", path: "F:/comic", readable: false, imageCount: 0,
  children: [
    { name: "第一卷", path: "F:/comic/vol1", readable: true, imageCount: 2, children: [chapter("F:/comic/vol1/ch01"), chapter("F:/comic/vol1/ch02")] },
    { name: "第二卷", path: "F:/comic/vol2", readable: false, imageCount: 0, children: [chapter("F:/comic/vol2/ch03")] },
  ],
};

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

test("each work restores its own search, status, view, expanded folders and page batches", () => {
  const storage = new MemoryStorage();
  const first = createLibraryBrowseState({ query: "第一卷 ch02", statusFilter: "reading", view: "list", expandedPaths: ["F:/comic/vol1"], visibleChapterCount: 600, childLimits: { "F:/comic": 300 } });
  const second = createLibraryBrowseState({ query: "终章", view: "tree", expandedPaths: [] });
  saveLibraryBrowseState("F:/comic", first, storage);
  saveLibraryBrowseState("F:/other", second, storage);
  assert.deepEqual(loadLibraryBrowseState("f:\\COMIC\\", storage), first);
  assert.deepEqual(loadLibraryBrowseState("F:/other", storage), second);
});

test("rescanning preserves user intent and keeps already loaded batches", () => {
  const saved = createLibraryBrowseState({ query: "ch", statusFilter: "unread", view: "list", expandedPaths: ["F:/comic/vol2"], revealedCollapsedGroups: ["F:/comic::leading-read"], filterCollapsedPaths: ["F:/comic/vol1"], visibleChapterCount: 400, childLimits: { "F:/comic": 200 } });
  const reconciled = reconcileLibraryBrowseState(saved, tree, ["F:/comic", "F:/comic/vol1"]);
  assert.deepEqual(reconciled, saved);
  assert.notEqual(reconciled, saved);
});

test("fresh works auto-expand suggested ancestors but explicit all-collapsed state remains collapsed", () => {
  assert.deepEqual(reconcileLibraryBrowseState(createLibraryBrowseState(), tree, ["F:/comic", "F:/comic/vol1"]).expandedPaths, ["F:/comic", "F:/comic/vol1"]);
  assert.deepEqual(reconcileLibraryBrowseState(createLibraryBrowseState({ expandedPaths: [] }), tree, ["F:/comic"]).expandedPaths, []);
});

test("removed and now-leaf folders are pruned and case changes use the current canonical path", () => {
  const saved = createLibraryBrowseState({
    expandedPaths: ["f:\\COMIC\\VOL1\\", "F:/comic/deleted", "F:/comic/vol1/ch01"],
    revealedCollapsedGroups: ["f:\\COMIC\\VOL1\\::leading-read", "F:/comic/deleted::leading-read", "F:/comic/vol1/ch01::leading-read", "invalid-key"],
    filterCollapsedPaths: ["F:/comic/vol2", "F:/comic/deleted"],
    childLimits: { "f:\\COMIC\\VOL1\\": 300, "F:/comic/deleted": 200, "F:/comic/vol1/ch01": 100 },
  });
  const reconciled = reconcileLibraryBrowseState(saved, tree, []);
  assert.deepEqual(reconciled.expandedPaths, ["F:/comic/vol1"]);
  assert.deepEqual(reconciled.revealedCollapsedGroups, ["F:/comic/vol1::leading-read"]);
  assert.deepEqual(reconciled.filterCollapsedPaths, ["F:/comic/vol2"]);
  assert.deepEqual(reconciled.childLimits, { "F:/comic/vol1": 300 });
});

test("invalid or unavailable session storage falls back to a usable browse state", () => {
  const fallback = createLibraryBrowseState();
  assert.deepEqual(loadLibraryBrowseState("x", { getItem: () => "invalid json" }), fallback);
  assert.deepEqual(loadLibraryBrowseState("x", { getItem: () => { throw new Error("blocked"); } }), fallback);
  assert.doesNotThrow(() => saveLibraryBrowseState("x", fallback, { setItem: () => { throw new Error("quota"); } }));
  const recovered = createLibraryBrowseState({ query: 5, statusFilter: "wrong", view: "grid", expandedPaths: [2, "a", "a"], visibleChapterCount: Infinity, childLimits: { a: -4, b: "1000" } });
  assert.equal(recovered.query, "");
  assert.equal(recovered.statusFilter, "all");
  assert.equal(recovered.view, "tree");
  assert.deepEqual(recovered.expandedPaths, ["a"]);
  assert.equal(recovered.visibleChapterCount, 200);
  assert.deepEqual(recovered.childLimits, { a: 100, b: 100 });
});

test("filtered trees keep matching ancestors while excluding unmatched readable parent chapters", () => {
  const original = JSON.stringify(tree);
  const filtered = filterDirectoryTree(tree, new Set(["F:/comic/vol1/ch02"]));
  assert.equal(filtered.children.length, 1);
  assert.equal(filtered.children[0].name, "第一卷");
  assert.equal(filtered.children[0].readable, false);
  assert.equal(filtered.children[0].imageCount, 0);
  assert.deepEqual(filtered.children[0].children.map((node) => node.path), ["F:/comic/vol1/ch02"]);
  assert.deepEqual(getDirectoryBranchPaths(filtered), ["F:/comic", "F:/comic/vol1"]);
  assert.equal(JSON.stringify(tree), original);
});

test("filters can match a parent chapter itself and report no matches without empty branches", () => {
  const filtered = filterDirectoryTree(tree, new Set(["F:/comic/vol1"]));
  assert.equal(filtered.children[0].readable, true);
  assert.equal(filtered.children[0].imageCount, 2);
  assert.deepEqual(filtered.children[0].children, []);
  assert.equal(filterDirectoryTree(tree, new Set()), null);
});
