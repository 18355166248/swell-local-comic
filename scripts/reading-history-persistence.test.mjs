import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Load the actual TypeScript helper and its local imports without a separate test build.
const moduleUrls = new Map();
async function getModuleUrl(sourceUrl) {
  if (moduleUrls.has(sourceUrl.href)) return moduleUrls.get(sourceUrl.href);
  const source = await readFile(sourceUrl, "utf8");
  let output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  const specifiers = [...output.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
  for (const specifier of new Set(specifiers)) {
    const target = specifier.startsWith(".")
      ? await getModuleUrl(new URL(`${specifier}.ts`, sourceUrl))
      : import.meta.resolve(specifier);
    output = output.replaceAll(`from "${specifier}"`, `from "${target}"`);
  }
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
  moduleUrls.set(sourceUrl.href, moduleUrl);
  return moduleUrl;
}

const { buildReadingHistoryInput } = await import(await getModuleUrl(new URL("../src/hooks/useReadingHistoryPersistence.ts", import.meta.url)));
const state = {
  folderName: "Chapter 1", folderPath: "F:/Comics/Chapter 1",
  files: [{ name: "01.png", path: "F:/Comics/Chapter 1/01.png" }, { name: "02.png", path: "F:/Comics/Chapter 1/02.png" }],
  currentIndex: 1, zoom: 1.2, viewMode: "scroll", imageWidth: 600, imagesPerGroup: 2,
  scrollRatio: 0.94, scrollPosition: 100, scrollHeight: 1200, isLoading: false,
};

test("an immediate scroll snapshot overrides uncommitted reader state", () => {
  const history = buildReadingHistoryInput(state, { position: 735, height: 1800 });
  assert.equal(history.scrollPosition, 735);
  assert.equal(history.scrollHeight, 1800);
  assert.equal(history.currentIndex, 1);
  assert.equal(history.currentFileName, "02.png");
  assert.equal(history.totalFiles, 2);
  assert.equal(state.scrollPosition, 100);
  assert.equal(state.scrollHeight, 1200);
});

test("normal buffered saves retain reader preferences while page mode ignores scroll snapshots", () => {
  const history = buildReadingHistoryInput(state);
  assert.equal(history.scrollPosition, 100);
  assert.equal(history.scrollHeight, 1200);
  assert.equal(history.zoom, 1.2);
  assert.equal(history.imageWidth, 600);
  assert.equal(history.imagesPerGroup, 2);
  assert.equal(history.scrollRatio, 0.94);
  assert.equal(history.files, state.files);
  const pageHistory = buildReadingHistoryInput({ ...state, viewMode: "page" }, { position: 735, height: 1800 });
  assert.equal(pageHistory.scrollPosition, undefined);
  assert.equal(pageHistory.scrollHeight, undefined);
  assert.equal(pageHistory.imagesPerGroup, 2);
});

test("immediate and buffered saves retain the grouping that produced the saved scroll offset", () => {
  for (const imagesPerGroup of [1, 2, 5, 20]) {
    const reader = { ...state, imagesPerGroup };
    const buffered = buildReadingHistoryInput(reader);
    const immediate = buildReadingHistoryInput(reader, { position: 735, height: 1800 });
    assert.equal(buffered.imagesPerGroup, imagesPerGroup);
    assert.equal(buffered.scrollPosition, 100);
    assert.equal(immediate.imagesPerGroup, imagesPerGroup);
    assert.equal(immediate.scrollPosition, 735);
  }
});

test("incomplete or loading chapters do not produce history entries", () => {
  assert.equal(buildReadingHistoryInput({ ...state, isLoading: true }), null);
  assert.equal(buildReadingHistoryInput({ ...state, folderName: "" }), null);
  assert.equal(buildReadingHistoryInput({ ...state, folderPath: "" }), null);
  assert.equal(buildReadingHistoryInput({ ...state, files: [] }), null);
});

test("leaving before progressive restoration finishes preserves the original saved location", () => {
  const restoring = { ...state, currentIndex: 1, scrollPosition: 735, scrollHeight: 1800, isRestoringScrollPosition: true };
  const history = buildReadingHistoryInput(restoring, { position: 0, height: 450 });
  assert.equal(history.currentIndex, 1);
  assert.equal(history.currentFileName, "02.png");
  assert.equal(history.scrollPosition, 735);
  assert.equal(history.scrollHeight, 1800);
  assert.equal(buildReadingHistoryInput(restoring).scrollPosition, 735);
  const afterUserIntent = buildReadingHistoryInput({ ...restoring, isRestoringScrollPosition: false }, { position: 0, height: 450 });
  assert.equal(afterUserIntent.scrollPosition, 0);
  assert.equal(afterUserIntent.scrollHeight, 450);
});

test("a pending page-anchor restore does not replace an absent pixel position with placeholder coordinates", () => {
  const history = buildReadingHistoryInput({ ...state, scrollPosition: undefined, scrollHeight: undefined, isRestoringScrollPosition: true }, { position: 0, height: 450 });
  assert.equal(history.currentIndex, 1);
  assert.equal(history.currentFileName, "02.png");
  assert.equal(history.scrollPosition, undefined);
  assert.equal(history.scrollHeight, undefined);
});
