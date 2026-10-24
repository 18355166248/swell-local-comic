import type { ComicDirectoryNode } from "../types";
import type { ChapterStatus } from "./libraryUtils";
import { normalizeLibraryPathId as pathId } from "./libraryUtils";

export const CHAPTER_PAGE_SIZE = 200;
export const DIRECTORY_PAGE_SIZE = 100;

export interface LibraryBrowseState {
  query: string;
  statusFilter: ChapterStatus | "all";
  view: "tree" | "list";
  expandedPaths: string[] | null;
  revealedCollapsedGroups: string[];
  filterCollapsedPaths: string[];
  visibleChapterCount: number;
  childLimits: Record<string, number>;
}

const strings = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((entry): entry is string => typeof entry === "string"))]
  : [];
const boundedCount = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value)
  ? Math.max(fallback, Math.min(Math.trunc(value), 1_000_000))
  : fallback;

export function createLibraryBrowseState(value?: unknown): LibraryBrowseState {
  const input = value && typeof value === "object" ? value as Partial<LibraryBrowseState> : {};
  const childLimits: Record<string, number> = {};
  if (input.childLimits && typeof input.childLimits === "object" && !Array.isArray(input.childLimits)) {
    for (const [path, count] of Object.entries(input.childLimits)) {
      if (path !== "__proto__" && path !== "constructor" && path !== "prototype") childLimits[path] = boundedCount(count, DIRECTORY_PAGE_SIZE);
    }
  }
  return {
    query: typeof input.query === "string" ? input.query : "",
    statusFilter: input.statusFilter === "unread" || input.statusFilter === "reading" || input.statusFilter === "read" ? input.statusFilter : "all",
    view: input.view === "list" ? "list" : "tree",
    expandedPaths: Array.isArray(input.expandedPaths) ? strings(input.expandedPaths) : null,
    revealedCollapsedGroups: strings(input.revealedCollapsedGroups),
    filterCollapsedPaths: strings(input.filterCollapsedPaths),
    visibleChapterCount: boundedCount(input.visibleChapterCount, CHAPTER_PAGE_SIZE),
    childLimits,
  };
}

export function loadLibraryBrowseState(rootId: string, storage: Pick<Storage, "getItem">): LibraryBrowseState {
  try {
    const value = storage.getItem(`comic_library_browse:${pathId(rootId)}`);
    return createLibraryBrowseState(value ? JSON.parse(value) : undefined);
  } catch {
    return createLibraryBrowseState();
  }
}

export function saveLibraryBrowseState(rootId: string, state: LibraryBrowseState, storage: Pick<Storage, "setItem">): void {
  try {
    storage.setItem(`comic_library_browse:${pathId(rootId)}`, JSON.stringify(state));
  } catch {
    // Browsing must remain usable if session storage is full or unavailable.
  }
}

/** Keep user intent across rescans while removing folders that no longer exist. */
export function reconcileLibraryBrowseState(
  state: LibraryBrowseState,
  tree: ComicDirectoryNode,
  initialExpandedPaths: string[],
): LibraryBrowseState {
  const branches = new Map<string, string>();
  const visit = (node: ComicDirectoryNode) => {
    if (node.children.length > 0) branches.set(pathId(node.path), node.path);
    node.children.forEach(visit);
  };
  visit(tree);
  const existingBranches = (values: string[]) => [...new Set(values.flatMap((path) => {
    const canonical = branches.get(pathId(path));
    return canonical ? [canonical] : [];
  }))];
  const childLimits: Record<string, number> = {};
  for (const [path, count] of Object.entries(state.childLimits)) {
    const canonical = branches.get(pathId(path));
    if (canonical) childLimits[canonical] = count;
  }
  return {
    ...state,
    expandedPaths: existingBranches(state.expandedPaths ?? initialExpandedPaths),
    filterCollapsedPaths: existingBranches(state.filterCollapsedPaths),
    revealedCollapsedGroups: [...new Set(state.revealedCollapsedGroups.flatMap((key) => {
      const suffix = "::leading-read";
      if (!key.endsWith(suffix)) return [];
      const canonical = branches.get(pathId(key.slice(0, -suffix.length)));
      return canonical ? [`${canonical}${suffix}`] : [];
    }))],
    childLimits,
  };
}

/** Keep matching chapters and their ancestors, without inventing readable parent chapters. */
export function filterDirectoryTree(node: ComicDirectoryNode, chapterPaths: Set<string>): ComicDirectoryNode | null {
  const children = node.children.flatMap((child) => {
    const filtered = filterDirectoryTree(child, chapterPaths);
    return filtered ? [filtered] : [];
  });
  const readable = node.readable && chapterPaths.has(node.path);
  return readable || children.length > 0 ? { ...node, readable, imageCount: readable ? node.imageCount : 0, children } : null;
}

export function getDirectoryBranchPaths(node: ComicDirectoryNode): string[] {
  return [...(node.children.length ? [node.path] : []), ...node.children.flatMap(getDirectoryBranchPaths)];
}
