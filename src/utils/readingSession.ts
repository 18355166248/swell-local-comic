import type { ChapterSequenceItem, LibraryItem, ReadingHistory } from "../types";
import { scanComicLibrary, scanImageFiles } from "./fileUtils";
import { getLibraryItems } from "./libraryStorage";
import { isPathInsideRoot, normalizeLibraryPathId } from "./libraryUtils";

interface ReadingSessionOptions {
  libraries?: LibraryItem[];
  chapters?: ChapterSequenceItem[];
  signal?: AbortSignal;
}

/** An older or cancelled entry must not route to the reader or change a newer session. */
export class StaleReadingSessionError extends Error {
  constructor() {
    super("Reading session was cancelled or superseded");
    this.name = "StaleReadingSessionError";
  }
}

let readingSessionGeneration = 0;

function waitForScan<T>(scan: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return scan;
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new StaleReadingSessionError());
    signal.addEventListener("abort", onAbort, { once: true });
    scan.then((value) => {
      signal.removeEventListener("abort", onAbort);
      resolve(value);
    }, (error: unknown) => {
      signal.removeEventListener("abort", onAbort);
      reject(error);
    });
    // Aborting between the caller's guard and listener registration is harmless.
    if (signal.aborted) onAbort();
  });
}

const sessionKeys = [
  "comicChapterSequence",
  "continueReading",
  "currentFolderPath",
  "openComicFolder",
  "directRestore",
  "restoreState",
];

function clearReadingSession() {
  sessionKeys.forEach((key) => sessionStorage.removeItem(key));
}

/** Prepare the same fresh reading session from a library, chapter list, or history. */
export async function prepareReadingSession(
  history: ReadingHistory,
  options: ReadingSessionOptions = {},
): Promise<string> {
  if (options.signal?.aborted) throw new StaleReadingSessionError();
  const generation = ++readingSessionGeneration;
  const isCurrent = () => generation === readingSessionGeneration && !options.signal?.aborted;
  const assertCurrent = () => {
    if (!isCurrent()) throw new StaleReadingSessionError();
  };
  try {
    clearReadingSession();
    if (!history.folderPath) throw new Error("这条记录没有有效的章节目录。");

    // Nested libraries are allowed. Use the closest owning root rather than its parent.
    const library = (options.libraries ?? getLibraryItems())
      .filter((item) => isPathInsideRoot(history.folderPath, item.rootPath))
      .sort((a, b) => normalizeLibraryPathId(b.rootPath).length - normalizeLibraryPathId(a.rootPath).length)[0];

    const chapterPromise = options.chapters !== undefined
      ? Promise.resolve(options.chapters)
      : library
        ? scanComicLibrary(library.rootPath).then((scan) => scan.chapters)
        : Promise.resolve([]);
    const [files, chapters] = await waitForScan(Promise.all([
      scanImageFiles(history.folderPath),
      chapterPromise,
    ]), options.signal);
    assertCurrent();
    if (files.length === 0) throw new Error("章节中已没有可读取的图片，请返回书库重新扫描。");

    const savedIndex = Number.isFinite(history.currentIndex) ? Math.trunc(history.currentIndex) : 0;
    const savedFile = history.currentFileName ?? history.files?.[savedIndex]?.name;
    const matchingIndex = savedFile ? files.findIndex((file) => file.name === savedFile) : -1;
    const currentIndex = matchingIndex >= 0
      ? matchingIndex
      : Math.max(0, Math.min(savedIndex, files.length - 1));
    const restored: ReadingHistory = {
      ...history,
      files,
      currentIndex,
      currentFileName: files[currentIndex].name,
      totalFiles: files.length,
    };
    // Blob URLs belong to the previous viewer instance and cannot be restored.
    delete restored.imageUrls;
    const filesChanged = history.files?.length !== files.length || files.some((file, index) =>
      normalizeLibraryPathId(file.path) !== normalizeLibraryPathId(history.files[index]?.path ?? ""),
    );
    if (filesChanged || currentIndex !== savedIndex) {
      // An absolute offset from a different file order can point to another page.
      // The reader restores the corrected currentIndex as an image anchor instead.
      delete restored.scrollPosition;
      delete restored.scrollHeight;
    }

    const currentPath = normalizeLibraryPathId(history.folderPath);
    assertCurrent();
    if (chapters.some((chapter) => normalizeLibraryPathId(chapter.path) === currentPath)) {
      sessionStorage.setItem(
        "comicChapterSequence",
        JSON.stringify(chapters.map(({ name, path }) => ({ name, path }))),
      );
    }
    sessionStorage.setItem("continueReading", JSON.stringify(restored));
    sessionStorage.setItem("currentFolderPath", history.folderPath);
    return "/viewer?fromContinueReading=true";
  } catch (error) {
    if (!isCurrent() || error instanceof StaleReadingSessionError) throw new StaleReadingSessionError();
    // A failed scan or storage write must never leave another book's navigation behind.
    try { clearReadingSession(); } catch { /* Storage may be unavailable. */ }
    const detail = error instanceof Error ? error.message : typeof error === "string" ? error : "请检查目录是否仍可访问后重试。";
    throw new Error(`无法继续阅读「${history.folderName}」：${detail}`);
  }
}
