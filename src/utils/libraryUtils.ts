import type {
  ComicChapter,
  LibraryItem,
  ReadingHistory,
  ReadingHistoryInput,
} from "../types";

export type ChapterStatus = "unread" | "reading" | "read";

export const normalizeLibraryPathId = (path: string): string =>
  path.replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();

export const isPathInsideRoot = (path: string, rootPath: string): boolean => {
  const normalizedPath = normalizeLibraryPathId(path);
  const normalizedRoot = normalizeLibraryPathId(rootPath);
  return (
    normalizedPath === normalizedRoot ||
    normalizedPath.startsWith(`${normalizedRoot}/`)
  );
};

export const mergeLibraryItem = (
  items: LibraryItem[],
  input: { name: string; rootPath: string; now?: number },
): LibraryItem[] => {
  const now = input.now ?? Date.now();
  const id = normalizeLibraryPathId(input.rootPath);
  const existing = items.find((item) => item.id === id);
  const nextItem: LibraryItem = {
    id,
    name: input.name,
    rootPath: input.rootPath,
    addedAt: existing?.addedAt ?? now,
    lastOpenedAt: now,
  };

  return [
    nextItem,
    ...items.filter((item) => item.id !== id),
  ].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
};

export const getRecentHistoryForLibrary = (
  histories: ReadingHistory[],
  rootPath: string,
): ReadingHistory | undefined =>
  histories
    .filter((history) => isPathInsideRoot(history.folderPath, rootPath))
    .sort((a, b) => b.lastReadTime - a.lastReadTime)[0];

export const getChapterStatus = (
  history: ReadingHistory | undefined,
): ChapterStatus => {
  if (!history) return "unread";
  if (history.totalFiles > 0 && history.currentIndex >= history.totalFiles - 1) {
    return "read";
  }
  return "reading";
};

export const createReadHistoryInputFromChapter = (
  chapter: ComicChapter,
): ReadingHistoryInput => ({
  folderName: chapter.name,
  folderPath: chapter.path,
  files: [],
  currentIndex: Math.max(chapter.imageCount - 1, 0),
  totalFiles: chapter.imageCount,
  viewMode: "scroll",
});

export const getHistoryProgressText = (
  history: ReadingHistory | undefined,
): string => {
  if (!history) return "未开始";

  if (history.viewMode === "scroll" && history.scrollPosition !== undefined) {
    if (history.scrollHeight && history.scrollHeight > 0) {
      const progress = Math.min(
        Math.round((history.scrollPosition / history.scrollHeight) * 100),
        100,
      );
      return `滚动 ${progress}%`;
    }
    return `滚动 ${Math.round(history.scrollPosition)}px`;
  }

  if (history.totalFiles <= 0) return "未开始";
  return `${history.currentIndex + 1} / ${history.totalFiles}`;
};
