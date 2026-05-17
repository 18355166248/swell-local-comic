import type { LibraryItem } from "../types";
import { mergeLibraryItem } from "./libraryUtils";

const STORAGE_KEY = "comic_library_items";

export const getLibraryItems = (): LibraryItem[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("读取漫画书库失败:", error);
    return [];
  }
};

export const saveLibraryItems = (items: LibraryItem[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("保存漫画书库失败:", error);
  }
};

export const addOrUpdateLibraryItem = (input: {
  name: string;
  rootPath: string;
}): LibraryItem[] => {
  const items = mergeLibraryItem(getLibraryItems(), input);
  saveLibraryItems(items);
  return items;
};

export const touchLibraryItem = (id: string): LibraryItem[] => {
  const now = Date.now();
  const items = getLibraryItems()
    .map((item) =>
      item.id === id ? { ...item, lastOpenedAt: now } : item,
    )
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  saveLibraryItems(items);
  return items;
};

export const deleteLibraryItem = (id: string): LibraryItem[] => {
  const items = getLibraryItems().filter((item) => item.id !== id);
  saveLibraryItems(items);
  return items;
};
