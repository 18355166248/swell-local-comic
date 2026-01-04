import type { ReadingHistory, ReadingHistoryInput } from "../types";

const STORAGE_KEY = "comic_reading_history";
const MAX_HISTORY_ITEMS = 50; // 限制历史记录数量

// 获取所有历史记录
export const getAllHistory = (): ReadingHistory[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
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
      (h) => h.folderPath === history.folderPath
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

    // 限制历史记录数量
    if (histories.length > MAX_HISTORY_ITEMS) {
      histories.splice(MAX_HISTORY_ITEMS);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(histories));
  } catch (error) {
    console.error("保存历史记录失败:", error);
  }
};

// 删除历史记录
export const deleteHistory = (folderPath: string): void => {
  try {
    const histories = getAllHistory();
    const filtered = histories.filter((h) => h.folderPath !== folderPath);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("删除历史记录失败:", error);
  }
};

// 根据文件夹名称删除历史记录（向后兼容）
export const deleteHistoryByName = (folderName: string): void => {
  try {
    const histories = getAllHistory();
    const filtered = histories.filter((h) => h.folderName !== folderName);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
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

// 获取指定文件夹的历史记录
export const getHistoryByFolder = (folderPath: string): ReadingHistory | null => {
  const histories = getAllHistory();
  return histories.find((h) => h.folderPath === folderPath) || null;
};

// 根据文件夹名称获取历史记录（向后兼容）
export const getHistoryByFolderName = (folderName: string): ReadingHistory | null => {
  const histories = getAllHistory();
  return histories.find((h) => h.folderName === folderName) || null;
};

