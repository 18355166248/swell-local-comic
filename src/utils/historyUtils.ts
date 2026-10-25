import type { ComicChapter, ComicFile, ReadingHistory, ReadingHistoryInput } from "../types";
import {
  createReadHistoryInputFromChapter,
  normalizeLibraryPathId,
} from "./libraryUtils";

const STORAGE_KEY = "comic_reading_history";

const filePath = (folderPath: string, name: string): string =>
  `${folderPath.replace(/[\\/]+$/, "")}${folderPath.includes("\\") ? "\\" : "/"}${name}`;

function readHistory(value: unknown): ReadingHistory | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<ReadingHistory>;
  if (typeof input.folderPath !== "string" || !input.folderPath.trim() || typeof input.folderName !== "string") return null;
  const folderPath = input.folderPath;
  const files: ComicFile[] = Array.isArray(input.files) ? input.files.flatMap((file) => {
    // New records store only filenames where the parent path can be recovered.
    if (typeof file === "string") return [{ name: file, path: filePath(folderPath, file) }];
    return file && typeof file.name === "string" && typeof file.path === "string" ? [file] : [];
  }) : [];
  const history: ReadingHistory = {
    ...input,
    folderName: input.folderName,
    folderPath,
    files,
    currentIndex: typeof input.currentIndex === "number" && Number.isFinite(input.currentIndex) ? Math.max(0, Math.trunc(input.currentIndex)) : 0,
    totalFiles: typeof input.totalFiles === "number" && Number.isFinite(input.totalFiles) ? Math.max(0, Math.trunc(input.totalFiles)) : files.length,
    lastReadTime: typeof input.lastReadTime === "number" && Number.isFinite(input.lastReadTime) ? input.lastReadTime : 0,
  };
  // Blob URLs expire with the reader and must never be persisted or restored.
  delete history.imageUrls;
  return history;
}

function writeHistories(histories: ReadingHistory[]): void {
  const stored = histories.map((history) => {
    const compact = {
      ...history,
      files: history.files.map((file) =>
        normalizeLibraryPathId(file.path) === normalizeLibraryPathId(filePath(history.folderPath, file.name)) ? file.name : file,
      ),
    };
    delete compact.imageUrls;
    return compact;
  });
  // Keep every chapter's progress; limiting recent activity must not erase read state.
  // Compact repeated parent paths instead, retaining file order for scroll restoration.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

// 获取所有历史记录
export const getAllHistory = (): ReadingHistory[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed: unknown = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    const byPath = new Map<string, ReadingHistory>();
    for (const value of parsed) {
      const history = readHistory(value);
      if (!history) continue;
      const key = normalizeLibraryPathId(history.folderPath);
      const previous = byPath.get(key);
      if (!previous || previous.lastReadTime <= history.lastReadTime) byPath.set(key, history);
    }
    return [...byPath.values()].sort((a, b) => b.lastReadTime - a.lastReadTime);
  } catch (error) {
    console.error("读取历史记录失败:", error);
    return [];
  }
};

// 保存历史记录
export const saveHistory = (history: ReadingHistoryInput): void => {
  try {
    const histories = getAllHistory();
    const existingIndex = histories.findIndex(
      (h) => normalizeLibraryPathId(h.folderPath) === normalizeLibraryPathId(history.folderPath)
    );

    const now = Date.now();

    if (existingIndex >= 0) {
      // 更新现有记录，保留首次阅读时间
      const existingHistory = histories[existingIndex];
      histories[existingIndex] = {
        ...history,
        lastReadTime: now,
        firstReadTime: existingHistory.firstReadTime || now,
      };
    } else {
      // 添加新记录
      histories.push({
        ...history,
        lastReadTime: now,
        firstReadTime: now,
      });
    }

    // 按最后阅读时间排序，最新的在前
    histories.sort((a, b) => b.lastReadTime - a.lastReadTime);

    writeHistories(histories);
  } catch (error) {
    console.error("保存历史记录失败:", error);
  }
};

// 删除历史记录
export const markChaptersAsRead = (chapters: ComicChapter[]): ReadingHistory[] => {
  try {
    const histories = getAllHistory();
    const byPath = new Map(
      histories.map((history) => [normalizeLibraryPathId(history.folderPath), history]),
    );
    const now = Date.now();

    chapters.forEach((chapter, index) => {
      const input = createReadHistoryInputFromChapter(chapter);
      const key = normalizeLibraryPathId(input.folderPath);
      const existing = byPath.get(key);
      byPath.set(key, {
        ...input,
        firstReadTime: existing?.firstReadTime ?? now,
        lastReadTime: now + index,
      });
    });

    const nextHistories = Array.from(byPath.values()).sort(
      (a, b) => b.lastReadTime - a.lastReadTime,
    );

    writeHistories(nextHistories);
    return nextHistories;
  } catch (error) {
    console.error("批量标记已读失败:", error);
    return getAllHistory();
  }
};

export const deleteHistory = (folderPath: string): void => {
  try {
    const histories = getAllHistory();
    const filtered = histories.filter((h) => normalizeLibraryPathId(h.folderPath) !== normalizeLibraryPathId(folderPath));
    writeHistories(filtered);
  } catch (error) {
    console.error("删除历史记录失败:", error);
  }
};

// 清空所有历史记录
export const clearAllHistory = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("清空历史记录失败:", error);
  }
};


