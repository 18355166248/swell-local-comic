import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const utilitiesUrl = dataModule(transpile(await readFile(new URL("../src/utils/libraryUtils.ts", import.meta.url), "utf8")));
const { normalizeLibraryPathId, getChapterStatus } = await import(utilitiesUrl);
const source = transpile(await readFile(new URL("../src/utils/historyUtils.ts", import.meta.url), "utf8"))
  .replaceAll('"./libraryUtils"', JSON.stringify(utilitiesUrl));
const { getAllHistory, saveHistory, markChaptersAsRead, deleteHistory } = await import(dataModule(source));

const storageKey = "comic_reading_history";
function setup(initial) {
  const values = new Map(initial === undefined ? [] : [[storageKey, JSON.stringify(initial)]]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  return storage;
}
const chapter = (index) => ({
  name: `第${index}章`, path: `F:/Comics/Book/${index}`, relativePath: String(index), imageCount: 20,
});
const history = (changes = {}) => ({
  folderName: "第一章", folderPath: "F:/Comics/Book/1", files: [],
  currentIndex: 4, totalFiles: 20, firstReadTime: 10, lastReadTime: 20, ...changes,
});

test("marking over 500 chapters read retains every chapter and another book's unfinished progress", () => {
  const existing = history({ folderPath: "F:/Comics/Other/1" });
  setup([existing]);
  const chapters = Array.from({ length: 1001 }, (_, index) => chapter(index));
  const result = markChaptersAsRead(chapters);
  assert.equal(result.length, 1002);
  const persisted = getAllHistory();
  assert.equal(persisted.length, 1002);
  assert.equal(persisted.filter((entry) => getChapterStatus(entry) === "read").length, 1001);
  assert.deepEqual(persisted.find((entry) => entry.folderPath === existing.folderPath), existing);
  assert.equal(getChapterStatus(persisted.find((entry) => entry.folderPath === chapters[0].path)), "read");
});

test("ordinary reader saves preserve older progress after the former 500 chapter limit", () => {
  setup();
  markChaptersAsRead(Array.from({ length: 600 }, (_, index) => chapter(index)));
  saveHistory(history({ folderPath: "F:/Comics/Other/1", currentIndex: 7 }));
  const persisted = getAllHistory();
  assert.equal(persisted.length, 601);
  assert.equal(getChapterStatus(persisted.find((entry) => entry.folderPath === chapter(0).path)), "read");
  assert.equal(persisted.find((entry) => entry.folderPath === "F:/Comics/Other/1").currentIndex, 7);
});

test("saving and deleting use the same normalized chapter identity", () => {
  setup([history()]);
  saveHistory(history({ folderPath: "f:\\COMICS\\Book\\1\\", currentIndex: 12 }));
  const persisted = getAllHistory();
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].currentIndex, 12);
  assert.equal(persisted[0].firstReadTime, 10);
  deleteHistory("F:/Comics/Book/1");
  assert.deepEqual(getAllHistory(), []);
});

test("legacy duplicate rows use the most recent progress and are removed together", () => {
  const older = history({ folderPath: "f:\\COMICS\\Book\\1\\", lastReadTime: 10 });
  const newer = history({ currentIndex: 12, lastReadTime: 30 });
  const storage = setup([newer, older]);
  assert.deepEqual(getAllHistory(), [newer]);
  saveHistory(history({ folderPath: "F:/Comics/Other/1" }));
  assert.equal(JSON.parse(storage.getItem(storageKey)).length, 2);
  deleteHistory("f:\\comics\\book\\1");
  assert.deepEqual(getAllHistory().map((entry) => entry.folderPath), ["F:/Comics/Other/1"]);
});

test("compact storage preserves filenames, order, scroll restoration and reader preferences", () => {
  const storage = setup();
  const folderPath = "F:\\Comics\\A long series folder name\\A long volume folder name\\Chapter 1\\";
  const files = Array.from({ length: 100 }, (_, index) => ({
    name: `${index + 1}.png`, path: `${folderPath}${index + 1}.png`,
  }));
  const original = history({
    folderPath, files, totalFiles: 100, currentIndex: 43, currentFileName: "44.png",
    viewMode: "scroll", scrollPosition: 43210, scrollHeight: 100000, zoom: 1.2,
    imageWidth: 800, scrollRatio: 0.94, imageUrls: ["blob:expired"],
  });
  saveHistory(original);
  const stored = JSON.parse(storage.getItem(storageKey))[0];
  assert.deepEqual(stored.files, files.map((file) => file.name));
  assert.equal(stored.imageUrls, undefined);
  assert.ok(storage.getItem(storageKey).length < JSON.stringify([original]).length / 3);
  const restored = getAllHistory()[0];
  assert.deepEqual(restored.files.map((file) => file.name), files.map((file) => file.name));
  assert.deepEqual(restored.files.map((file) => normalizeLibraryPathId(file.path)), files.map((file) => normalizeLibraryPathId(file.path)));
  for (const field of ["currentIndex", "currentFileName", "totalFiles", "viewMode", "scrollPosition", "scrollHeight", "zoom", "imageWidth", "scrollRatio"]) {
    assert.equal(restored[field], original[field], field);
  }
  assert.equal(restored.imageUrls, undefined);
  assert.deepEqual(original.imageUrls, ["blob:expired"]);
});

test("legacy file objects and unusual file locations remain recoverable", () => {
  const original = history({ files: [
    { name: "01.png", path: "F:/Comics/Book/1/01.png" },
    { name: "02.png", path: "F:/Comics/Other/02.png" },
  ] });
  const storage = setup([original]);
  assert.deepEqual(getAllHistory(), [original]);
  saveHistory(original);
  assert.deepEqual(JSON.parse(storage.getItem(storageKey))[0].files, ["01.png", original.files[1]]);
  assert.deepEqual(getAllHistory()[0].files, original.files);
});

test("invalid stored shapes do not crash library or history pages", () => {
  for (const value of [null, {}, 123, "unexpected"]) {
    setup(value);
    assert.deepEqual(getAllHistory(), []);
  }
  setup([null, {}, { folderPath: "" }, history(), history({ folderPath: "F:/Comics/Book/2", files: [null, {}], lastReadTime: null })]);
  const persisted = getAllHistory();
  assert.equal(persisted.length, 2);
  assert.equal(persisted[1].lastReadTime, 0);
  assert.deepEqual(persisted[1].files, []);
});

test("a failed storage write preserves existing progress without evicting records", (t) => {
  const original = history();
  const storage = setup([original]);
  t.mock.method(storage, "setItem", () => { throw new Error("Storage quota exceeded"); });
  t.mock.method(console, "error", () => {});
  assert.deepEqual(markChaptersAsRead([chapter(2)]), [original]);
  saveHistory(history({ folderPath: "F:/Comics/Other/1" }));
  assert.deepEqual(getAllHistory(), [original]);
});
