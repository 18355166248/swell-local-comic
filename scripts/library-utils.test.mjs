import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function importTsModule(path) {
  const source = await readFile(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

const libraryUtils = await importTsModule(new URL("../src/utils/libraryUtils.ts", import.meta.url));
const navigationUtils = await importTsModule(new URL("../src/utils/navigationUtils.ts", import.meta.url));

test("normalizeLibraryPathId creates stable ids from paths", () => {
  assert.equal(
    libraryUtils.normalizeLibraryPathId("G:\\Download\\Cartoon\\復仇母女丼"),
    "g:/download/cartoon/復仇母女丼",
  );
  assert.equal(
    libraryUtils.normalizeLibraryPathId("G:/Download/Cartoon/復仇母女丼/"),
    "g:/download/cartoon/復仇母女丼",
  );
});

test("mergeLibraryItem adds new items and updates existing ones without duplicates", () => {
  const first = libraryUtils.mergeLibraryItem([], {
    name: "復仇母女丼",
    rootPath: "G:\\Download\\Cartoon\\復仇母女丼",
    now: 100,
  });

  const second = libraryUtils.mergeLibraryItem(first, {
    name: "復仇母女丼 新名",
    rootPath: "G:/Download/Cartoon/復仇母女丼/",
    now: 200,
  });

  assert.equal(second.length, 1);
  assert.equal(second[0].name, "復仇母女丼 新名");
  assert.equal(second[0].addedAt, 100);
  assert.equal(second[0].lastOpenedAt, 200);
});

test("getRecentHistoryForLibrary finds the newest history below a root path", () => {
  const histories = [
    {
      folderName: "第1話",
      folderPath: "G:\\Download\\Cartoon\\復仇母女丼\\第1話",
      files: [],
      currentIndex: 2,
      totalFiles: 10,
      lastReadTime: 100,
    },
    {
      folderName: "第2話",
      folderPath: "G:/Download/Cartoon/復仇母女丼/第2話",
      files: [],
      currentIndex: 4,
      totalFiles: 20,
      lastReadTime: 300,
    },
    {
      folderName: "其他",
      folderPath: "G:/Download/Cartoon/Other/第1話",
      files: [],
      currentIndex: 0,
      totalFiles: 1,
      lastReadTime: 500,
    },
  ];

  const recent = libraryUtils.getRecentHistoryForLibrary(
    histories,
    "G:\\Download\\Cartoon\\復仇母女丼",
  );

  assert.equal(recent?.folderName, "第2話");
});

test("getChapterStatus classifies unread, reading, and read chapters", () => {
  assert.equal(libraryUtils.getChapterStatus(undefined), "unread");
  assert.equal(
    libraryUtils.getChapterStatus({
      folderName: "第1話",
      folderPath: "x",
      files: [],
      currentIndex: 1,
      totalFiles: 10,
      lastReadTime: 1,
    }),
    "reading",
  );
  assert.equal(
    libraryUtils.getChapterStatus({
      folderName: "第1話",
      folderPath: "x",
      files: [],
      currentIndex: 9,
      totalFiles: 10,
      lastReadTime: 1,
    }),
    "read",
  );
});

test("createReadHistoryInputFromChapter marks the chapter as read", () => {
  assert.deepEqual(
    libraryUtils.createReadHistoryInputFromChapter({
      name: "chapter 2",
      path: "G:/comic/chapter 2",
      relativePath: "volume 1/chapter 2",
      imageCount: 12,
    }),
    {
      folderName: "chapter 2",
      folderPath: "G:/comic/chapter 2",
      files: [],
      currentIndex: 11,
      totalFiles: 12,
      viewMode: "scroll",
    },
  );
});

test("getPrimaryNavItems keeps only top-level management pages", () => {
  assert.deepEqual(navigationUtils.getPrimaryNavItems(), [
    { label: "书库", to: "/" },
    { label: "阅读历史", to: "/history" },
  ]);
});

test("getLibraryBreadcrumb formats a clear library detail trail", () => {
  assert.deepEqual(navigationUtils.getLibraryBreadcrumb("復仇母女丼"), [
    { label: "书库", to: "/" },
    { label: "復仇母女丼" },
  ]);
});

const previewChapters = [1, 2, 3].map((n) => ({
  name: `第${n}话`, path: `G:/comic/volume/${n}`, relativePath: `第一卷/第${n}话`, imageCount: 10,
}));
const previewHistory = (n, currentIndex, lastReadTime) => ({
  folderName: `第${n}话`, folderPath: `g:\\COMIC\\volume\\${n}\\`, files: [], totalFiles: 10, currentIndex, lastReadTime,
});
const previewTree = {
  name: "comic", path: "G:/comic", imageCount: 0, readable: false,
  children: [{
    name: "volume", path: "G:/comic/volume", imageCount: 0, readable: false,
    children: previewChapters.map((chapter) => ({ ...chapter, readable: true, children: [] })),
  }],
};

test("preview index aggregates nested chapters and chooses latest normalized history", () => {
  const index = libraryUtils.buildLibraryPreviewIndex(previewTree, [
    previewHistory(1, 9, 100), previewHistory(2, 3, 200), previewHistory(2, 9, 50),
  ]);
  assert.deepEqual(index.totals, { total: 3, read: 1, reading: 1 });
  assert.deepEqual(index.progressByPath.get("G:/comic/volume"), index.totals);
  assert.equal(index.historyByPath.get("g:/comic/volume/2").currentIndex, 3);
});

test("preview filters combine path terms and reading status without changing chapter order", () => {
  const index = libraryUtils.buildLibraryPreviewIndex(previewTree, [previewHistory(1, 9, 100), previewHistory(2, 3, 200)]);
  assert.deepEqual(libraryUtils.filterLibraryChapters(previewChapters, index.historyByPath, " 第一卷   第2 ", "reading"), [previewChapters[1]]);
  assert.deepEqual(libraryUtils.filterLibraryChapters(previewChapters, index.historyByPath, "第一卷", "unread"), [previewChapters[2]]);
  assert.deepEqual(libraryUtils.filterLibraryChapters(previewChapters, index.historyByPath, "第2", "read"), []);
});

test("suggested chapter resumes latest unfinished chapter, then unread, and handles completion", () => {
  const index = libraryUtils.buildLibraryPreviewIndex(previewTree, [previewHistory(1, 2, 100), previewHistory(2, 3, 200)]);
  assert.equal(libraryUtils.getSuggestedChapter(previewChapters, index.historyByPath), previewChapters[1]);
  index.historyByPath.set("g:/comic/volume/1", previewHistory(1, 9, 300));
  index.historyByPath.set("g:/comic/volume/2", previewHistory(2, 9, 400));
  assert.equal(libraryUtils.getSuggestedChapter(previewChapters, index.historyByPath), previewChapters[2]);
  index.historyByPath.set("g:/comic/volume/3", previewHistory(3, 9, 500));
  assert.equal(libraryUtils.getSuggestedChapter(previewChapters, index.historyByPath), undefined);
  assert.equal(libraryUtils.getSuggestedChapter([], index.historyByPath), undefined);
});

test("preview totals count images in a parent directory as a chapter too", () => {
  const index = libraryUtils.buildLibraryPreviewIndex({ ...previewTree, readable: true, imageCount: 4 }, []);
  assert.deepEqual(index.totals, { total: 4, read: 0, reading: 0 });
});
