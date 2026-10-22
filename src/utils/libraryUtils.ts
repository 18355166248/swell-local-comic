import type {
  ComicChapter,
  ComicDirectoryNode,
  LibraryItem,
  ReadingHistory,
  ReadingHistoryInput,
} from "../types";

export type ChapterStatus = "unread" | "reading" | "read";

export interface DirectoryProgress {
  total: number;
  read: number;
  reading: number;
}

// Build once per scan/history update, rather than searching history at every tree node.
export const buildLibraryPreviewIndex = (
  tree: ComicDirectoryNode,
  histories: ReadingHistory[],
) => {
  const historyByPath = new Map<string, ReadingHistory>();
  for (const history of histories) {
    const key = normalizeLibraryPathId(history.folderPath);
    const previous = historyByPath.get(key);
    if (!previous || previous.lastReadTime < history.lastReadTime) {
      historyByPath.set(key, history);
    }
  }
  const progressByPath = new Map<string, DirectoryProgress>();
  const visit = (node: ComicDirectoryNode): DirectoryProgress => {
    const status = getChapterStatus(historyByPath.get(normalizeLibraryPathId(node.path)));
    const progress: DirectoryProgress = {
      total: Number(node.readable),
      read: Number(node.readable && status === "read"),
      reading: Number(node.readable && status === "reading"),
    };
    for (const child of node.children) {
      const childProgress = visit(child);
      progress.total += childProgress.total;
      progress.read += childProgress.read;
      progress.reading += childProgress.reading;
    }
    progressByPath.set(node.path, progress);
    return progress;
  };
  const totals = visit(tree);
  return { historyByPath, progressByPath, totals };
};

export const filterLibraryChapters = (
  chapters: ComicChapter[],
  historyByPath: Map<string, ReadingHistory>,
  query: string,
  status: ChapterStatus | "all",
): ComicChapter[] => {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return chapters.filter((chapter) => {
    if (status !== "all" && getChapterStatus(historyByPath.get(normalizeLibraryPathId(chapter.path))) !== status) {
      return false;
    }
    const text = `${chapter.name} ${chapter.relativePath}`.toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
};

export const getSuggestedChapter = (
  chapters: ComicChapter[],
  historyByPath: Map<string, ReadingHistory>,
): ComicChapter | undefined => {
  // Prefer the most recently unfinished chapter, then the first unread chapter.
  let recent: ComicChapter | undefined;
  let recentTime = -Infinity;
  for (const chapter of chapters) {
    const history = historyByPath.get(normalizeLibraryPathId(chapter.path));
    if (getChapterStatus(history) === "reading" && history && history.lastReadTime > recentTime) {
      recent = chapter;
      recentTime = history.lastReadTime;
    }
  }
  return recent ?? chapters.find((chapter) => !historyByPath.has(normalizeLibraryPathId(chapter.path)));
};

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
