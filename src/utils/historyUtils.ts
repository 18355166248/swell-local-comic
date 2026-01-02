import type { ReadingHistory } from "../types";

const STORAGE_KEY = "comic_reading_history";

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
export const saveHistory = (history: ReadingHistory): void => {
  try {
    const histories = getAllHistory();
    const existingIndex = histories.findIndex(
      (h) => h.folderName === history.folderName
    );

    if (existingIndex >= 0) {
      // 更新现有记录
      histories[existingIndex] = {
        ...history,
        lastReadTime: Date.now(),
      };
    } else {
      // 添加新记录
      histories.push({
        ...history,
        lastReadTime: Date.now(),
      });
    }

    // 按最后阅读时间排序，最新的在前
    histories.sort((a, b) => b.lastReadTime - a.lastReadTime);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(histories));
  } catch (error) {
    console.error("保存历史记录失败:", error);
  }
};

// 删除历史记录
export const deleteHistory = (folderName: string): void => {
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
export const getHistoryByFolder = (folderName: string): ReadingHistory | null => {
  const histories = getAllHistory();
  return histories.find((h) => h.folderName === folderName) || null;
};

