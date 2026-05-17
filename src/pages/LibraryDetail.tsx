import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type {
  ComicChapter,
  ComicDirectoryNode,
  ComicLibraryScanResult,
  LibraryItem,
  ReadingHistory,
} from "../types";
import { scanComicLibrary } from "../utils/fileUtils";
import { getAllHistory, markChaptersAsRead } from "../utils/historyUtils";
import { getLibraryItems, touchLibraryItem } from "../utils/libraryStorage";
import {
  getChapterStatus,
  getHistoryProgressText,
  normalizeLibraryPathId,
} from "../utils/libraryUtils";
import { getLibraryBreadcrumb } from "../utils/navigationUtils";

const CHAPTER_PAGE_SIZE = 200;

const statusLabel = {
  unread: "未读",
  reading: "阅读中",
  read: "已读",
};

const statusClass = {
  unread: "bg-gray-800 text-gray-300",
  reading: "bg-blue-600/20 text-blue-200",
  read: "bg-green-600/20 text-green-200",
};

interface ChapterContextMenu {
  x: number;
  y: number;
  chapterPath: string;
}

function findHistory(
  histories: ReadingHistory[],
  folderPath: string,
): ReadingHistory | undefined {
  const target = normalizeLibraryPathId(folderPath);
  return histories.find(
    (history) => normalizeLibraryPathId(history.folderPath) === target,
  );
}

function isNodeFullyRead(
  node: ComicDirectoryNode,
  histories: ReadingHistory[],
): boolean {
  const ownHistory = node.readable ? findHistory(histories, node.path) : undefined;
  const ownRead = !node.readable || getChapterStatus(ownHistory) === "read";
  return ownRead && node.children.every((child) => isNodeFullyRead(child, histories));
}

function buildAutoExpandedPaths(
  node: ComicDirectoryNode,
  histories: ReadingHistory[],
  isRoot = false,
  expanded = new Set<string>(),
): Set<string> {
  const shouldExpand = isRoot || !isNodeFullyRead(node, histories);
  if (!shouldExpand) return expanded;

  expanded.add(node.path);
  node.children.forEach((child) => {
    buildAutoExpandedPaths(child, histories, false, expanded);
  });
  return expanded;
}

function getLeadingFullyReadChildCount(
  children: ComicDirectoryNode[],
  histories: ReadingHistory[],
): number {
  let count = 0;
  for (const child of children) {
    if (!isNodeFullyRead(child, histories)) {
      break;
    }
    count += 1;
  }
  return count;
}

interface DirectoryNodeProps {
  node: ComicDirectoryNode;
  histories: ReadingHistory[];
  selectedPaths: Set<string>;
  expandedPaths: Set<string>;
  revealedCollapsedGroups: Set<string>;
  onOpenChapter: (path: string) => void;
  onToggleChapter: (path: string) => void;
  onToggleExpand: (path: string) => void;
  onToggleCollapsedGroup: (path: string) => void;
  onOpenContextMenu: (path: string, event: MouseEvent<HTMLElement>) => void;
  level?: number;
}

function DirectoryNode({
  node,
  histories,
  selectedPaths,
  expandedPaths,
  revealedCollapsedGroups,
  onOpenChapter,
  onToggleChapter,
  onToggleExpand,
  onToggleCollapsedGroup,
  onOpenContextMenu,
  level = 0,
}: DirectoryNodeProps) {
  const history = node.readable ? findHistory(histories, node.path) : undefined;
  const status = getChapterStatus(history);
  const isSelected = selectedPaths.has(node.path);
  const isExpanded = expandedPaths.has(node.path);
  const hasChildren = node.children.length > 0;
  const collapsedGroupKey = `${node.path}::leading-read`;
  const leadingReadCount = hasChildren
    ? getLeadingFullyReadChildCount(node.children, histories)
    : 0;
  const isCollapsedGroupRevealed = revealedCollapsedGroups.has(collapsedGroupKey);
  const visibleChildren =
    leadingReadCount > 0 && !isCollapsedGroupRevealed
      ? node.children.slice(leadingReadCount)
      : node.children;

  return (
    <div className="space-y-2">
      <div
        className={`flex items-center justify-between gap-3 rounded-xl border bg-[#111821] px-4 py-3 ${
          isSelected ? "border-blue-500/80" : "border-white/8"
        } ${node.readable ? "cursor-pointer hover:border-blue-500/70" : ""}`}
        style={{ marginLeft: `${level * 18}px` }}
        onClick={() => {
          if (node.readable) onOpenChapter(node.path);
        }}
        onContextMenu={(event) => {
          if (node.readable) onOpenContextMenu(node.path, event);
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {hasChildren ? (
            <button
              type="button"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs text-gray-400 transition-colors hover:bg-white/8 hover:text-white"
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpand(node.path);
              }}
              aria-label={isExpanded ? "折叠目录" : "展开目录"}
            >
              {isExpanded ? "−" : "+"}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}

          {node.readable ? (
            <input
              type="checkbox"
              checked={isSelected}
              className="h-4 w-4 accent-blue-500"
              aria-label={`选择 ${node.name}`}
              onClick={(event) => event.stopPropagation()}
              onChange={() => onToggleChapter(node.path)}
            />
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {node.readable ? (
            <span
              className={`inline-flex h-6 w-16 shrink-0 items-center justify-center rounded px-2 py-1 text-xs ${statusClass[status]}`}
            >
              {statusLabel[status]}
            </span>
          ) : (
            <span className="w-16 shrink-0" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-gray-500">
                {node.readable ? "CH" : "DIR"}
              </span>
              <span className="truncate font-medium">{node.name}</span>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {node.readable
                ? `${node.imageCount} 张图片`
                : `${node.children.length} 个子目录`}
            </div>
          </div>
        </div>

        {node.readable && (
          <span className="inline-flex w-24 shrink-0 justify-end text-xs text-gray-500">
            {getHistoryProgressText(history)}
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-2">
          {leadingReadCount > 0 && (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-2 text-left text-sm text-emerald-200 transition-colors hover:border-emerald-700/60 hover:bg-emerald-950/30"
              style={{ marginLeft: `${(level + 1) * 18}px` }}
              onClick={() => onToggleCollapsedGroup(collapsedGroupKey)}
            >
              <span>
                {isCollapsedGroupRevealed
                  ? `隐藏前 ${leadingReadCount} 个已读目录`
                  : `已折叠前 ${leadingReadCount} 个已读目录`}
              </span>
              <span className="text-xs text-emerald-300/80">
                {isCollapsedGroupRevealed ? "收起" : "展开"}
              </span>
            </button>
          )}

          {visibleChildren.map((child) => (
            <DirectoryNode
              key={child.path}
              node={child}
              histories={histories}
              selectedPaths={selectedPaths}
              expandedPaths={expandedPaths}
              revealedCollapsedGroups={revealedCollapsedGroups}
              onOpenChapter={onOpenChapter}
              onToggleChapter={onToggleChapter}
              onToggleExpand={onToggleExpand}
              onToggleCollapsedGroup={onToggleCollapsedGroup}
              onOpenContextMenu={onOpenContextMenu}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LibraryDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rootId = searchParams.get("root");
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [scan, setScan] = useState<ComicLibraryScanResult | null>(null);
  const [histories, setHistories] = useState<ReadingHistory[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChapterPaths, setSelectedChapterPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [revealedCollapsedGroups, setRevealedCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const [visibleChapterCount, setVisibleChapterCount] = useState(CHAPTER_PAGE_SIZE);
  const [contextMenu, setContextMenu] = useState<ChapterContextMenu | null>(null);
  const breadcrumbs = getLibraryBreadcrumb(item?.name ?? "目录预览");

  useEffect(() => {
    const libraryItem = getLibraryItems().find((candidate) => candidate.id === rootId);
    setItem(libraryItem ?? null);
    setHistories(getAllHistory());

    if (!libraryItem) {
      setIsLoading(false);
      setError("未找到这个书库条目。");
      return;
    }

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await scanComicLibrary(libraryItem.rootPath);
        if (!cancelled) {
          setScan(result);
          touchLibraryItem(libraryItem.id);
        }
      } catch (scanError) {
        if (!cancelled) {
          setError(scanError instanceof Error ? scanError.message : "扫描目录失败。");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [rootId]);

  const filteredChapters = useMemo(() => {
    if (!scan) return [];
    const value = query.trim().toLowerCase();
    if (!value) return scan.chapters;
    return scan.chapters.filter((chapter) =>
      `${chapter.name} ${chapter.relativePath}`.toLowerCase().includes(value),
    );
  }, [query, scan]);

  const visibleChapters = useMemo(
    () => filteredChapters.slice(0, visibleChapterCount),
    [filteredChapters, visibleChapterCount],
  );

  const selectedChapters = useMemo(() => {
    if (!scan) return [];
    return scan.chapters.filter((chapter) => selectedChapterPaths.has(chapter.path));
  }, [scan, selectedChapterPaths]);

  const isSearching = query.trim().length > 0;

  useEffect(() => {
    setSelectedChapterPaths(new Set());
    setExpandedPaths(
      scan ? buildAutoExpandedPaths(scan.tree, histories, true) : new Set(),
    );
    setRevealedCollapsedGroups(new Set());
    setVisibleChapterCount(CHAPTER_PAGE_SIZE);
    setContextMenu(null);
  }, [histories, scan]);

  useEffect(() => {
    if (!contextMenu) return;
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [contextMenu]);

  const chapterMap = useMemo(() => {
    if (!scan) return new Map<string, ComicChapter>();
    return new Map(scan.chapters.map((chapter) => [chapter.path, chapter]));
  }, [scan]);

  const toggleChapterSelection = (chapterPath: string) => {
    setContextMenu(null);
    setSelectedChapterPaths((current) => {
      const next = new Set(current);
      if (next.has(chapterPath)) {
        next.delete(chapterPath);
      } else {
        next.add(chapterPath);
      }
      return next;
    });
  };

  const toggleExpanded = (path: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleCollapsedGroup = (path: string) => {
    setRevealedCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedChapterPaths(new Set());
    setContextMenu(null);
  };

  const openChapterContextMenu = (
    chapterPath: string,
    event: MouseEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedChapterPaths((current) =>
      current.has(chapterPath) ? current : new Set([chapterPath]),
    );
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      chapterPath,
    });
  };

  const markRead = (chapters: ComicChapter[]) => {
    if (chapters.length === 0) return;
    const nextHistories = markChaptersAsRead(chapters);
    setHistories(nextHistories);
    if (scan) {
      setExpandedPaths(buildAutoExpandedPaths(scan.tree, nextHistories, true));
    }
    clearSelection();
  };

  const handleContextMarkRead = () => {
    if (!contextMenu) return;
    const targetChapter = chapterMap.get(contextMenu.chapterPath);
    if (!targetChapter) return;

    const chapters = selectedChapterPaths.has(contextMenu.chapterPath)
      ? selectedChapters
      : [targetChapter];

    markRead(chapters);
  };

  const openChapter = (chapterPath: string) => {
    if (!scan) return;
    const chapter = scan.chapters.find((candidate) => candidate.path === chapterPath);
    if (!chapter) return;

    const sequence = scan.chapters.map((candidate) => ({
      name: candidate.name,
      path: candidate.path,
    }));
    sessionStorage.setItem("comicChapterSequence", JSON.stringify(sequence));

    const history = findHistory(histories, chapter.path);
    if (history?.files.length) {
      sessionStorage.setItem("continueReading", JSON.stringify(history));
      sessionStorage.setItem("currentFolderPath", history.folderPath);
      navigate("/viewer?fromContinueReading=true");
      return;
    }

    sessionStorage.setItem(
      "openComicFolder",
      JSON.stringify({ name: chapter.name, path: chapter.path }),
    );
    navigate("/viewer?openFolder=true");
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {crumb.to ? (
                <button
                  onClick={() => navigate(crumb.to ?? "/")}
                  className="text-blue-300 hover:text-blue-200"
                >
                  {crumb.label}
                </button>
              ) : (
                <span>{crumb.label}</span>
              )}
              {index < breadcrumbs.length - 1 && <span>/</span>}
            </span>
          ))}
        </div>
        <h1 className="truncate text-2xl font-semibold">{item?.name ?? "目录预览"}</h1>
        <p className="mt-1 truncate text-sm text-gray-500">{item?.rootPath}</p>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-white/8 bg-[#111821] p-8 text-center text-gray-300">
          正在扫描目录...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-8 text-center text-red-200">
          {error}
        </div>
      ) : scan && scan.chapters.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-[#111821] p-8 text-center text-gray-300">
          未找到可阅读章节。请确认目录中包含 JPG、PNG、GIF、WebP 或 BMP 图片。
        </div>
      ) : scan ? (
        <>
          <section className="mb-4 rounded-2xl border border-white/8 bg-[#111821] p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setVisibleChapterCount(CHAPTER_PAGE_SIZE);
                  }}
                  placeholder="搜索章节名或路径"
                  className="w-full max-w-xl rounded-xl border border-white/8 bg-[#0c1117] px-4 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
                />
                {isSearching && (
                  <button
                    onClick={() => {
                      setQuery("");
                      setVisibleChapterCount(CHAPTER_PAGE_SIZE);
                    }}
                    className="rounded-xl border border-white/8 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
                  >
                    清除
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-400">
                {isSearching
                  ? `搜索结果 ${filteredChapters.length}`
                  : `章节 ${scan.chapters.length} · 根目录已展开`}
              </div>
            </div>
          </section>

          {selectedChapters.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-500/40 bg-blue-500/10 px-4 py-3">
              <div className="text-sm text-blue-100">
                已选中 {selectedChapters.length} 个章节
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => markRead(selectedChapters)}
                  className="rounded-xl border border-green-700/70 bg-green-600/15 px-3 py-2 text-sm font-medium text-green-100 transition-colors hover:border-green-500 hover:bg-green-600/25"
                >
                  标记为已读
                </button>
                <button
                  onClick={clearSelection}
                  className="rounded-xl border border-white/8 bg-[#111821] px-3 py-2 text-sm text-gray-200 transition-colors hover:border-gray-500"
                >
                  清空选择
                </button>
              </div>
            </div>
          )}

          {!isSearching ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">目录结构</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    先按目录浏览，展开到具体章节再进入阅读。
                  </p>
                </div>
              </div>
              <DirectoryNode
                node={scan.tree}
                histories={histories}
                selectedPaths={selectedChapterPaths}
                expandedPaths={expandedPaths}
                revealedCollapsedGroups={revealedCollapsedGroups}
                onOpenChapter={openChapter}
                onToggleChapter={toggleChapterSelection}
                onToggleExpand={toggleExpanded}
                onToggleCollapsedGroup={toggleCollapsedGroup}
                onOpenContextMenu={openChapterContextMenu}
              />
            </section>
          ) : (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">章节结果</h2>
                <p className="mt-1 text-sm text-gray-500">
                  搜索时只显示匹配章节，不再同时渲染目录树。
                </p>
              </div>
              <div className="space-y-2">
                {visibleChapters.map((chapter) => {
                  const history = findHistory(histories, chapter.path);
                  const status = getChapterStatus(history);
                  const isSelected = selectedChapterPaths.has(chapter.path);
                  return (
                    <div
                      key={chapter.path}
                      onClick={() => openChapter(chapter.path)}
                      onContextMenu={(event) => openChapterContextMenu(chapter.path, event)}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-blue-500/80 bg-blue-500/10"
                          : "border-white/8 bg-[#111821] hover:border-blue-500/70"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            className="h-4 w-4 accent-blue-500"
                            aria-label={`选择 ${chapter.name}`}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleChapterSelection(chapter.path)}
                          />
                          <span
                            className={`inline-flex h-6 w-16 shrink-0 items-center justify-center rounded px-2 py-1 text-xs ${statusClass[status]}`}
                          >
                            {statusLabel[status]}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {chapter.name}
                            </div>
                            <div className="mt-1 truncate text-xs text-gray-500">
                              {chapter.relativePath} · {chapter.imageCount} 张
                            </div>
                          </div>
                        </div>
                        <span className="inline-flex w-24 shrink-0 justify-end text-xs text-gray-500">
                          {getHistoryProgressText(history)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {filteredChapters.length === 0 && (
                  <div className="rounded-2xl border border-white/8 bg-[#111821] p-6 text-center text-sm text-gray-500">
                    没有匹配的章节
                  </div>
                )}

                {visibleChapters.length < filteredChapters.length && (
                  <button
                    onClick={() =>
                      setVisibleChapterCount((current) => current + CHAPTER_PAGE_SIZE)
                    }
                    className="w-full rounded-xl border border-white/8 bg-[#111821] px-3 py-3 text-sm text-gray-300 transition-colors hover:border-blue-500/60 hover:text-white"
                  >
                    继续加载章节 ({visibleChapters.length} / {filteredChapters.length})
                  </button>
                )}
              </div>
            </section>
          )}
        </>
      ) : null}

      {contextMenu && (
        <div
          className="fixed z-50 min-w-[180px] rounded-xl border border-gray-700 bg-gray-950 p-1 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleContextMarkRead}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-100 transition-colors hover:bg-green-600/20"
          >
            标记为已读
          </button>
        </div>
      )}
    </main>
  );
}
