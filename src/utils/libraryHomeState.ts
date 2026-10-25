export interface LibraryHomePreferences {
  sort: "recent" | "name";
  layout: "grid" | "list";
}

const PREFERENCES_KEY = "comic_library_home_preferences";
const QUERY_KEY = "comic_library_home_query";

export function loadLibraryHomePreferences(storage: Pick<Storage, "getItem">): LibraryHomePreferences {
  try {
    const value = JSON.parse(storage.getItem(PREFERENCES_KEY) ?? "null");
    return {
      sort: value?.sort === "name" ? "name" : "recent",
      layout: value?.layout === "list" ? "list" : "grid",
    };
  } catch {
    return { sort: "recent", layout: "grid" };
  }
}

export function saveLibraryHomePreferences(preferences: LibraryHomePreferences, storage: Pick<Storage, "setItem">): void {
  try { storage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* Browsing remains available when storage is full. */ }
}

export function loadLibraryHomeQuery(storage: Pick<Storage, "getItem">): string {
  try { return storage.getItem(QUERY_KEY) ?? ""; } catch { return ""; }
}

export function saveLibraryHomeQuery(query: string, storage: Pick<Storage, "setItem" | "removeItem">): void {
  try {
    if (query) storage.setItem(QUERY_KEY, query);
    else storage.removeItem(QUERY_KEY);
  } catch { /* Search remains available when storage is full. */ }
}
