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
