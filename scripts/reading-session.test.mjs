import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const utilities = dataModule(transpile(await readFile(new URL("../src/utils/libraryUtils.ts", import.meta.url), "utf8")));
const dependencies = {
  "./libraryUtils": utilities,
  "./fileUtils": dataModule(`
    export const scanComicLibrary = (...args) => globalThis.__readingSessionTest.scanComicLibrary(...args);
    export const scanImageFiles = (...args) => globalThis.__readingSessionTest.scanImageFiles(...args);
  `),
  "./libraryStorage": dataModule("export const getLibraryItems = () => globalThis.__readingSessionTest.libraries;"),
};
let source = transpile(await readFile(new URL("../src/utils/readingSession.ts", import.meta.url), "utf8"));
for (const [specifier, url] of Object.entries(dependencies)) source = source.replaceAll(JSON.stringify(specifier), JSON.stringify(url));
const { prepareReadingSession, StaleReadingSessionError } = await import(dataModule(source));

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

const chapterPath = "F:/books/series/ch01";
const files = ["01.png", "02.png", "03.png"].map((name) => ({ name, path: `${chapterPath}/${name}` }));
const chapters = [
  { name: "第一章", path: chapterPath, imageCount: 3 },
  { name: "第二章", path: "F:/books/series/ch02", imageCount: 5 },
];
const history = (changes = {}) => ({
  folderName: "第一章", folderPath: chapterPath, files, currentIndex: 1,
  currentFileName: "02.png", totalFiles: 3, lastReadTime: 100, ...changes,
});
const library = (rootPath) => ({ id: rootPath, name: rootPath, rootPath, addedAt: 1, lastOpenedAt: 1 });

function setup(changes = {}) {
  const scans = [];
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "sessionStorage", { value: storage, configurable: true });
  globalThis.__readingSessionTest = {
    libraries: [library("F:/books/series")],
    scanComicLibrary: async (path) => { scans.push(path); return { chapters }; },
    scanImageFiles: async () => files,
    ...changes,
  };
  for (const key of ["comicChapterSequence", "continueReading", "currentFolderPath", "openComicFolder", "directRestore", "restoreState"]) {
    storage.setItem(key, "stale data from a different book");
  }
  return { scans, storage, restored: () => JSON.parse(storage.getItem("continueReading")) };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

test("history continuation rebuilds navigation from the closest owning library", async () => {
  const { scans, storage, restored } = setup({ libraries: [library("F:/books"), library("f:\\BOOKS\\series\\")] });
  assert.equal(await prepareReadingSession(history()), "/viewer?fromContinueReading=true");
  assert.deepEqual(scans, ["f:\\BOOKS\\series\\"]);
  assert.deepEqual(JSON.parse(storage.getItem("comicChapterSequence")), chapters.map(({ name, path }) => ({ name, path })));
  assert.equal(restored().currentFileName, "02.png");
  assert.equal(storage.getItem("currentFolderPath"), chapterPath);
  for (const key of ["openComicFolder", "directRestore", "restoreState"]) assert.equal(storage.getItem(key), null, key);
});

test("removed libraries do not reuse the previous book's chapter sequence", async () => {
  const { scans, storage } = setup({ libraries: [library("F:/books/series-other")] });
  await prepareReadingSession(history());
  assert.deepEqual(scans, []);
  assert.equal(storage.getItem("comicChapterSequence"), null);
  assert.ok(storage.getItem("continueReading"));
});

test("pre-scanned chapters avoid scanning the entire library again", async () => {
  const { scans, storage } = setup();
  await prepareReadingSession(history(), { chapters });
  assert.deepEqual(scans, []);
  assert.equal(JSON.parse(storage.getItem("comicChapterSequence")).length, 2);
});

test("manual read marks hydrate fresh files and discard expired image URLs", async () => {
  const original = history({ files: [], currentIndex: 9, currentFileName: undefined, totalFiles: 10, imageUrls: ["blob:expired"] });
  const { restored } = setup();
  await prepareReadingSession(original);
  assert.deepEqual(restored().files, files);
  assert.equal(restored().currentIndex, 2);
  assert.equal(restored().totalFiles, 3);
  assert.equal(restored().imageUrls, undefined);
  assert.deepEqual(original.imageUrls, ["blob:expired"]);
  assert.deepEqual(original.files, []);
});

test("new files preserve the current filename and deleted files clamp the fallback index", async () => {
  const insertedFiles = [{ name: "00.png", path: `${chapterPath}/00.png` }, ...files];
  let state = setup({ scanImageFiles: async () => insertedFiles });
  await prepareReadingSession(history());
  assert.equal(state.restored().currentIndex, 2);
  state = setup({ scanImageFiles: async () => [files[0]] });
  await prepareReadingSession(history({ currentIndex: 50 }));
  assert.equal(state.restored().currentIndex, 0);
  assert.equal(state.restored().currentFileName, "01.png");
});

test("a changed file order discards the obsolete pixel offset without changing the input history", async () => {
  const original = history({ scrollPosition: 1200, scrollHeight: 3000, viewMode: "scroll" });
  const insertedFiles = [{ name: "00.png", path: `${chapterPath}/00.png` }, ...files];
  const { restored } = setup({ scanImageFiles: async () => insertedFiles });
  await prepareReadingSession(original);
  assert.equal(restored().currentIndex, 2);
  assert.equal(restored().currentFileName, "02.png");
  assert.equal(restored().scrollPosition, undefined);
  assert.equal(restored().scrollHeight, undefined);
  assert.equal(original.scrollPosition, 1200);
  assert.equal(original.scrollHeight, 3000);
});

test("an unchanged file order keeps its precise offset despite Windows path casing and separators", async () => {
  const { restored } = setup({ scanImageFiles: async () => files.map((file) => ({ ...file, path: file.path.toUpperCase().replaceAll("/", "\\") })) });
  await prepareReadingSession(history({ scrollPosition: 1200, scrollHeight: 3000 }));
  assert.equal(restored().currentIndex, 1);
  assert.equal(restored().scrollPosition, 1200);
  assert.equal(restored().scrollHeight, 3000);
});

test("history, library continuation and chapter entry retain grouping with its exact saved offset", async () => {
  for (const options of [{}, { libraries: [library("F:/books/series")] }, { chapters }]) {
    const { restored } = setup();
    await prepareReadingSession(history({ imagesPerGroup: 2, scrollPosition: 1200, scrollHeight: 3000 }), options);
    assert.equal(restored().imagesPerGroup, 2);
    assert.equal(restored().scrollPosition, 1200);
    assert.equal(restored().scrollHeight, 3000);
  }
});

test("a corrected page anchor retains its saved image grouping after files change", async () => {
  const insertedFiles = [{ name: "00.png", path: `${chapterPath}/00.png` }, ...files];
  const { restored } = setup({ scanImageFiles: async () => insertedFiles });
  await prepareReadingSession(history({ imagesPerGroup: 2, scrollPosition: 1200 }));
  assert.equal(restored().imagesPerGroup, 2);
  assert.equal(restored().currentIndex, 2);
  assert.equal(restored().scrollPosition, undefined);
});

test("correcting a mismatched saved filename also drops an offset for the wrong page", async () => {
  const { restored } = setup();
  await prepareReadingSession(history({ currentIndex: 0, currentFileName: "03.png", scrollPosition: 100, scrollHeight: 3000 }));
  assert.equal(restored().currentIndex, 2);
  assert.equal(restored().scrollPosition, undefined);
  assert.equal(restored().scrollHeight, undefined);
});

test("a stale provided sequence is not saved for an unrelated chapter", async () => {
  const { storage } = setup();
  await prepareReadingSession(history(), { chapters: [{ name: "other", path: "F:/other" }] });
  assert.equal(storage.getItem("comicChapterSequence"), null);
});

test("scan errors leave no partial restore state and include the chapter name", async () => {
  const { storage } = setup({ scanComicLibrary: async () => { throw "目录已被移动"; } });
  await assert.rejects(prepareReadingSession(history()), /无法继续阅读「第一章」：目录已被移动/);
  assert.equal(storage.values.size, 0);
});

test("empty chapters are reported before routing to the viewer", async () => {
  const { storage } = setup({ scanImageFiles: async () => [] });
  await assert.rejects(prepareReadingSession(history()), /章节中已没有可读取的图片/);
  assert.equal(storage.values.size, 0);
});

test("failed session writes remove chapter navigation and partial history", async () => {
  const { storage } = setup();
  const setItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => { if (key === "continueReading") throw new Error("存储空间不足"); setItem(key, value); };
  await assert.rejects(prepareReadingSession(history()), /存储空间不足/);
  assert.equal(storage.values.size, 0);
});

for (const outcome of ["success", "failure"]) {
  test(`an older scan's late ${outcome} cannot replace or clear the newer session`, async () => {
    const oldScan = deferred();
    const nextPath = "F:/books/series/ch02";
    const nextFiles = [{ name: "next.png", path: `${nextPath}/next.png` }];
    const { storage, restored } = setup({ scanImageFiles: (path) => path === chapterPath ? oldScan.promise : Promise.resolve(nextFiles) });
    const oldRequest = prepareReadingSession(history(), { chapters });
    const oldRejected = assert.rejects(oldRequest, StaleReadingSessionError);
    await prepareReadingSession(history({ folderName: "第二章", folderPath: nextPath, files: nextFiles, currentIndex: 0, currentFileName: "next.png" }), { chapters });
    if (outcome === "success") oldScan.resolve(files);
    else oldScan.reject(new Error("older scan failed"));
    await oldRejected;
    assert.equal(restored().folderPath, nextPath);
    assert.equal(storage.getItem("currentFolderPath"), nextPath);
    assert.deepEqual(JSON.parse(storage.getItem("comicChapterSequence")), chapters.map(({ name, path }) => ({ name, path })));
  });
}

test("aborting an entry rejects immediately and its late scan cannot write restore data", async () => {
  const scan = deferred();
  const controller = new AbortController();
  const { storage } = setup({ scanImageFiles: () => scan.promise });
  const request = prepareReadingSession(history(), { chapters, signal: controller.signal });
  const rejected = assert.rejects(request, StaleReadingSessionError);
  controller.abort();
  await rejected;
  assert.equal(storage.values.size, 0);
  scan.resolve(files);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(storage.values.size, 0);
});

test("an already cancelled entry does not invalidate a pending valid entry", async () => {
  const scan = deferred();
  const { restored } = setup({ scanImageFiles: () => scan.promise });
  const validRequest = prepareReadingSession(history(), { chapters });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(prepareReadingSession(history(), { chapters, signal: controller.signal }), StaleReadingSessionError);
  scan.resolve(files);
  assert.equal(await validRequest, "/viewer?fromContinueReading=true");
  assert.equal(restored().folderPath, chapterPath);
});
