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
import ChapterPreview from "../components/ChapterPreview";
import { ChevronDownIcon, ChevronRightIcon } from "../components/Icons";
import { buildLibraryPreviewIndex, filterLibraryChapters, getSuggestedChapter } from "../utils/libraryUtils";
import type { ChapterStatus, DirectoryProgress } from "../utils/libraryUtils";
import { useLibraryBrowseState } from "../hooks/useLibraryBrowseState";
import {
  CHAPTER_PAGE_SIZE,
  DIRECTORY_PAGE_SIZE,
  filterDirectoryTree,
  getDirectoryBranchPaths,
  reconcileLibraryBrowseState,
} from "../utils/libraryBrowseState";
import { useReadingSessionEntry } from "../hooks/useReadingSessionEntry";

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

type PreviewIndex = ReturnType<typeof buildLibraryPreviewIndex>;

function isNodeFullyRead(node: ComicDirectoryNode, progressByPath: Map<string, DirectoryProgress>): boolean {
  const progress = progressByPath.get(node.path);
  return Boolean(progress && progress.total > 0 && progress.read === progress.total);
}

function buildAutoExpandedPaths(
  node: ComicDirectoryNode,
  progressByPath: Map<string, DirectoryProgress>,
  isRoot = false,
  expanded = new Set<string>(),
): Set<string> {
  const progress = progressByPath.get(node.path);
  const shouldExpand = isRoot || Boolean(progress?.reading);
  if (!shouldExpand) return expanded;

  expanded.add(node.path);
  node.children.forEach((child) => {
    buildAutoExpandedPaths(child, progressByPath, false, expanded);
  });
  return expanded;
}

function getLeadingFullyReadChildCount(
  children: ComicDirectoryNode[],
  progressByPath: Map<string, DirectoryProgress>,
): number {
  let count = 0;
  for (const child of children) {
    if (!isNodeFullyRead(child, progressByPath)) {
      break;
    }
    count += 1;
  }
  return count;
}

interface DirectoryNodeProps {
  node: ComicDirectoryNode;
  index: PreviewIndex;
  selectedPaths: Set<string>;
  expandedPaths: Set<string>;
  revealedCollapsedGroups: Set<string>;
  childLimits: Record<string, number>;
  collapseReadGroups: boolean;
  onOpenChapter: (path: string) => void;
  onPreviewChapter: (path: string) => void;
  onToggleChapter: (path: string) => void;
  onToggleExpand: (path: string) => void;
  onToggleCollapsedGroup: (path: string) => void;
  onLoadChildren: (path: string) => void;
  onOpenContextMenu: (path: string, event: MouseEvent<HTMLElement>) => void;
  level?: number;
}

function DirectoryNode({
  node,
  index,
  selectedPaths,
  expandedPaths,
  revealedCollapsedGroups,
  childLimits,
  collapseReadGroups,
  onOpenChapter,
  onPreviewChapter,
  onToggleChapter,
  onToggleExpand,
  onToggleCollapsedGroup,
  onLoadChildren,
  onOpenContextMenu,
  level = 0,
}: DirectoryNodeProps) {
  const childLimit = childLimits[node.path] ?? DIRECTORY_PAGE_SIZE;
  const history = node.readable ? index.historyByPath.get(normalizeLibraryPathId(node.path)) : undefined;
  const progress = index.progressByPath.get(node.path);
  const status = getChapterStatus(history);
  const isSelected = selectedPaths.has(node.path);
  const isExpanded = expandedPaths.has(node.path);
  const hasChildren = node.children.length > 0;
  const collapsedGroupKey = `${node.path}::leading-read`;
  const leadingReadCount = hasChildren && collapseReadGroups
    ? getLeadingFullyReadChildCount(node.children, index.progressByPath)
    : 0;
  const isCollapsedGroupRevealed = revealedCollapsedGroups.has(collapsedGroupKey);
  const visibleChildren =
    leadingReadCount > 0 && !isCollapsedGroupRevealed
      ? node.children.slice(leadingReadCount)
      : node.children;

  return (
    <div>
      <div
        className={`flex min-h-14 items-center justify-between gap-3 border-b border-white/6 px-3 py-2.5 transition-colors ${isSelected ? "bg-blue-500/10" : "hover:bg-white/[0.025]"}`}
        style={{ paddingLeft: `${12 + Math.min(level, 5) * 16}px` }}
        onContextMenu={(event) => {
          if (node.readable) onOpenContextMenu(node.path, event);
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {hasChildren ? (
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400"
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpand(node.path);
              }}
              aria-label={isExpanded ? "折叠目录" : "展开目录"}
              aria-expanded={isExpanded}
            >
              {isExpanded ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
            </button>
          ) : (
            <span className="hidden w-8 shrink-0 sm:block" />
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
            null
          )}

          {node.readable ? (
            <span
              className={`inline-flex w-12 shrink-0 items-center justify-center rounded py-1 text-xs ${statusClass[status]}`}
            >
              {statusLabel[status]}
            </span>
          ) : (
            null
          )}

          <button type="button" onClick={() => node.readable ? onOpenChapter(node.path) : onToggleExpand(node.path)} className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400" aria-label={node.readable ? `阅读 ${node.name}` : `${isExpanded ? "折叠" : "展开"} ${node.name}`} aria-expanded={hasChildren && !node.readable ? isExpanded : undefined}>
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium" title={node.path}>{node.name}</span>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {node.readable
                ? `${node.imageCount} 张图片`
                : `${progress?.total ?? 0} 章 · 已读 ${progress?.read ?? 0}`}
            </div>
          </button>
        </div>

        {node.readable && (
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs text-gray-400 sm:inline">{getHistoryProgressText(history)}</span>
            <button type="button" onClick={() => onPreviewChapter(node.path)} aria-label={`预览 ${node.name}`} className="ui-button text-xs text-blue-200">预览</button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div>
          {leadingReadCount > 0 && (
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 border-b border-white/6 bg-emerald-950/10 py-2 pr-3 text-left text-xs text-emerald-200/80 transition-colors hover:bg-emerald-950/25"
              style={{ paddingLeft: `${12 + Math.min(level + 1, 5) * 16}px` }}
              aria-expanded={isCollapsedGroupRevealed}
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

          {visibleChildren.slice(0, childLimit).map((child) => (
            <DirectoryNode
              key={child.path}
              node={child}
              index={index}
              selectedPaths={selectedPaths}
              expandedPaths={expandedPaths}
              revealedCollapsedGroups={revealedCollapsedGroups}
              childLimits={childLimits}
              collapseReadGroups={collapseReadGroups}
              onOpenChapter={onOpenChapter}
              onPreviewChapter={onPreviewChapter}
              onToggleChapter={onToggleChapter}
              onToggleExpand={onToggleExpand}
              onToggleCollapsedGroup={onToggleCollapsedGroup}
              onLoadChildren={onLoadChildren}
              onOpenContextMenu={onOpenContextMenu}
              level={level + 1}
            />
          ))}
          {visibleChildren.length > childLimit && <button type="button" onClick={() => onLoadChildren(node.path)} className="ui-button mx-auto my-3 block text-blue-200">加载更多目录（{Math.min(childLimit, visibleChildren.length)} / {visibleChildren.length}）</button>}
        </div>
      )}
    </div>
  );
}

export default function LibraryDetail() {
  const [searchParams] = useSearchParams();
  const rootId = searchParams.get("root");
  return <LibraryDetailContent key={rootId ?? "missing-library"} rootId={rootId} />;
}

function LibraryDetailContent({ rootId }: { rootId: string | null }) {
  const navigate = useNavigate();
  const [item] = useState<LibraryItem | null>(() => getLibraryItems().find((candidate) => candidate.id === rootId) ?? null);
  const [scanState, setScanState] = useState<{
    scan: ComicLibraryScanResult | null;
    isLoading: boolean;
    error: string | null;
  }>(() => ({ scan: null, isLoading: Boolean(item), error: item ? null : "未找到这个书库条目。" }));
  const { scan, isLoading, error } = scanState;
  const [histories, setHistories] = useState<ReadingHistory[]>(() => getAllHistory());
  const [browse, setBrowse] = useLibraryBrowseState(rootId ?? "missing-library");
  const { query, statusFilter, view, visibleChapterCount } = browse;
  const [refreshCount, setRefreshCount] = useState(0);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const { openingPath, error: readingError, run: openReading } = useReadingSessionEntry();
  const openError = readingError?.message;
  const [selectedChapterPaths, setSelectedChapterPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [contextMenu, setContextMenu] = useState<ChapterContextMenu | null>(null);
  const breadcrumbs = getLibraryBreadcrumb(item?.name ?? "目录预览");

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    const load = async () => {
      try {
        const result = await scanComicLibrary(item.rootPath);
        if (!cancelled) {
          const nextHistories = getAllHistory();
          const nextIndex = buildLibraryPreviewIndex(result.tree, nextHistories);
          setHistories(nextHistories);
          setBrowse((current) => reconcileLibraryBrowseState(current, result.tree, [...buildAutoExpandedPaths(result.tree, nextIndex.progressByPath, true)]));
          const validPaths = new Set(result.chapters.map((chapter) => chapter.path));
          setSelectedChapterPaths((current) => new Set([...current].filter((path) => validPaths.has(path))));
          setPreviewPath((current) => current && validPaths.has(current) ? current : null);
          setScanState({ scan: result, isLoading: false, error: null });
          touchLibraryItem(item.id);
        }
      } catch (scanError) {
        if (!cancelled) {
          const message = typeof scanError === "string" ? scanError : scanError instanceof Error ? scanError.message : "扫描目录失败。";
          setScanState((current) => ({ ...current, isLoading: false, error: message }));
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [item, refreshCount, setBrowse]);

  const index = useMemo(() => scan ? buildLibraryPreviewIndex(scan.tree, histories) : null, [scan, histories]);

  const filteredChapters = useMemo(() => {
    if (!scan || !index) return [];
    return filterLibraryChapters(scan.chapters, index.historyByPath, query, statusFilter);
  }, [query, scan, index, statusFilter]);

  const suggestedChapter = useMemo(() => scan && index ? getSuggestedChapter(scan.chapters, index.historyByPath) : undefined, [scan, index]);
  const previewChapter = scan?.chapters.find((chapter) => chapter.path === previewPath);

  const visibleChapters = useMemo(
    () => filteredChapters.slice(0, visibleChapterCount),
    [filteredChapters, visibleChapterCount],
  );

  const selectedChapters = useMemo(() => {
    if (!scan) return [];
    return scan.chapters.filter((chapter) => selectedChapterPaths.has(chapter.path));
  }, [scan, selectedChapterPaths]);

  const isSearching = query.trim().length > 0;
  const hasFilters = isSearching || statusFilter !== "all";
  const showList = view === "list";
  const filteredTree = useMemo(() => scan
    ? hasFilters ? filterDirectoryTree(scan.tree, new Set(filteredChapters.map((chapter) => chapter.path))) : scan.tree
    : null, [scan, hasFilters, filteredChapters]);
  const treeIndex = useMemo(() => filteredTree ? buildLibraryPreviewIndex(filteredTree, histories) : null, [filteredTree, histories]);
  const expandedPaths = useMemo(() => new Set(hasFilters && filteredTree
    ? getDirectoryBranchPaths(filteredTree).filter((path) => !browse.filterCollapsedPaths.includes(path))
    : browse.expandedPaths ?? []), [hasFilters, filteredTree, browse.filterCollapsedPaths, browse.expandedPaths]);
  const revealedCollapsedGroups = useMemo(() => new Set(browse.revealedCollapsedGroups), [browse.revealedCollapsedGroups]);

  const updateFilters = (nextQuery: string, nextStatus: ChapterStatus | "all") => {
    setBrowse((current) => ({ ...current, query: nextQuery, statusFilter: nextStatus, visibleChapterCount: CHAPTER_PAGE_SIZE, filterCollapsedPaths: [] }));
  };

  const refreshDirectory = () => {
    setContextMenu(null);
    setScanState((current) => ({ ...current, isLoading: true, error: null }));
    setRefreshCount((current) => current + 1);
  };

  useEffect(() => {
    if (!contextMenu) return;
    const closeMenu = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeMenu(); };
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", closeOnEscape);
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
    setBrowse((current) => {
      const key = hasFilters ? "filterCollapsedPaths" : "expandedPaths";
      const next = new Set(current[key] ?? []);
      if (next.has(path)) next.delete(path); else next.add(path);
      return { ...current, [key]: [...next] };
    });
  };

  const toggleCollapsedGroup = (path: string) => {
    setBrowse((current) => {
      const next = new Set(current.revealedCollapsedGroups);
      if (next.has(path)) next.delete(path); else next.add(path);
      return { ...current, revealedCollapsedGroups: [...next] };
    });
  };

  const loadMoreChildren = (path: string) => {
    setBrowse((current) => ({
      ...current,
      childLimits: { ...current.childLimits, [path]: (current.childLimits[path] ?? DIRECTORY_PAGE_SIZE) + DIRECTORY_PAGE_SIZE },
    }));
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
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 204)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 64)),
      chapterPath,
    });
  };

  const markRead = (chapters: ComicChapter[]) => {
    if (chapters.length === 0) return;
    const nextHistories = markChaptersAsRead(chapters);
    setHistories(nextHistories);
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
    const history = index?.historyByPath.get(normalizeLibraryPathId(chapter.path));
    return openReading(history ?? {
      folderName: chapter.name,
      folderPath: chapter.path,
      files: [],
      currentIndex: 0,
      totalFiles: chapter.imageCount,
      lastReadTime: Date.now(),
    }, { chapters: scan.chapters });
  };

  return (
    <main className="app-page space-y-4" aria-busy={isLoading}>
      <div>
        <nav aria-label="当前位置" className="mb-2 flex items-center gap-2 text-xs text-gray-500">
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
        </nav>
        <h1 className="page-heading truncate">{item?.name ?? "目录预览"}</h1>
        <p className="mt-1.5 truncate text-xs text-gray-500" title={item?.rootPath}>{item?.rootPath}</p>
      </div>

      {openingPath && <p role="status" className="text-xs text-blue-200">正在打开章节…</p>}
      {openError && <p role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">{openError}</p>}
      {scan && isLoading && <p role="status" className="text-xs text-gray-400">正在刷新目录，当前浏览位置会保留…</p>}
      {scan && error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200"><p>刷新失败，仍显示上次扫描结果。{error}</p><button type="button" onClick={refreshDirectory} className="ui-button shrink-0">重新扫描</button></div>}
      {isLoading && !scan ? (
        <div role="status" className="surface-panel p-8 text-center text-sm text-gray-300">
          正在扫描目录...
        </div>
      ) : error && !scan ? (
        <div role="alert" className="rounded-2xl border border-red-900/60 bg-red-950/30 p-8 text-center text-red-200">
          <p>{error}</p>
          <button type="button" onClick={refreshDirectory} className="ui-button mt-4">重新扫描</button>
        </div>
      ) : scan && scan.chapters.length === 0 ? (
        <div className="surface-panel p-8 text-center text-sm text-gray-300">
          未找到可阅读章节。请确认目录中包含 JPG、PNG、GIF、WebP 或 BMP 图片。
          <button type="button" onClick={refreshDirectory} className="ui-button mx-auto mt-4 block">重新扫描</button>
        </div>
      ) : scan && index ? (
        <>
          <section aria-label="阅读概览" className="border-b border-white/8 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-sm font-medium text-gray-200">章节进度</h2>
                  <span className="text-xs text-gray-400">已读 {index.totals.read} / {index.totals.total} 章</span>
                </div>
                <div role="progressbar" aria-label="已读章节比例" aria-valuenow={index.totals.read} aria-valuemin={0} aria-valuemax={index.totals.total} className="mt-2 h-1 max-w-sm overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-blue-400 transition-[width]" style={{width: `${index.totals.total ? index.totals.read / index.totals.total * 100 : 0}%`}} />
                </div>
                <p className="mt-2 text-xs text-gray-500">{index.totals.reading} 章阅读中 · 共 {scan.chapters.reduce((sum, chapter) => sum + chapter.imageCount, 0).toLocaleString()} 张图片</p>
              </div>
              <div className="flex max-w-full items-center gap-3">
                {suggestedChapter ? (
                  <button type="button" disabled={openingPath !== null} onClick={() => void openChapter(suggestedChapter.path)} className="ui-button ui-button-primary flex min-w-0 items-center gap-2 text-left">
                    <span>{index.historyByPath.has(normalizeLibraryPathId(suggestedChapter.path)) ? "继续阅读" : "开始下一章"}</span>
                    <span className="hidden max-w-40 truncate text-xs font-normal text-blue-100 sm:inline" title={suggestedChapter.relativePath}>{suggestedChapter.name}</span>
                  </button>
                ) : <span className="text-sm text-emerald-300">已读完全部章节</span>}
                <button type="button" onClick={refreshDirectory} disabled={isLoading} title="重新扫描磁盘中的章节" className="ui-button">{isLoading ? "扫描中…" : "刷新目录"}</button>
              </div>
            </div>
          </section>
          <section className="surface-panel p-3" aria-label="查找章节">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <input
                  type="search"
                  aria-label="搜索章节名或路径"
                  value={query}
                  onChange={(event) => {
                    updateFilters(event.target.value, statusFilter);
                  }}
                  placeholder="搜索章节名或路径"
                  className="ui-input w-full max-w-xl"
                />
                {isSearching && (
                  <button
                    onClick={() => {
                      updateFilters("", statusFilter);
                    }}
                    className="ui-button"
                  >
                    清除
                  </button>
                )}
              </div>
              <div aria-live="polite" className="text-xs text-gray-500">
                {hasFilters
                  ? `匹配 ${filteredChapters.length} 章`
                  : `共 ${scan.chapters.length} 章`}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-2">
              <div role="group" aria-label="按阅读状态筛选" className="flex flex-wrap gap-1.5">
                {(["all", "unread", "reading", "read"] as const).map((status) => {
                  const counts = { all: index.totals.total, unread: index.totals.total - index.totals.read - index.totals.reading, reading: index.totals.reading, read: index.totals.read };
                  return <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => updateFilters(query, status)} className={`rounded-lg px-3 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-blue-400 ${statusFilter === status ? "bg-blue-500/20 text-blue-100" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}`}>{status === "all" ? "全部" : statusLabel[status]} <span className="ml-1 tabular-nums opacity-75">{counts[status]}</span></button>;
                })}
              </div>
              <div role="group" aria-label="浏览方式" className="flex rounded-lg border border-white/10 p-1">
                <button type="button" aria-pressed={!showList} onClick={() => setBrowse((current) => ({ ...current, view: "tree" }))} className={`rounded-md px-3 py-1.5 text-xs ${!showList ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>目录</button>
                <button type="button" aria-pressed={showList} onClick={() => setBrowse((current) => ({ ...current, view: "list" }))} className={`rounded-md px-3 py-1.5 text-xs ${showList ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>列表</button>
              </div>
            </div>
          </section>

          {selectedChapters.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-500/25 bg-blue-500/5 px-4 py-2">
              <div className="text-sm text-blue-100">
                已选中 {selectedChapters.length} 个章节
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => markRead(selectedChapters)}
                  className="ui-button text-emerald-200"
                >
                  标记为已读
                </button>
                <button
                  onClick={clearSelection}
                  className="ui-button"
                >
                  清空选择
                </button>
              </div>
            </div>
          )}

          {!showList && filteredTree && treeIndex ? (
            <section className="surface-panel overflow-hidden" aria-label="目录结构">
              <DirectoryNode
                node={filteredTree}
                index={treeIndex}
                selectedPaths={selectedChapterPaths}
                expandedPaths={expandedPaths}
                revealedCollapsedGroups={revealedCollapsedGroups}
                childLimits={browse.childLimits}
                collapseReadGroups={!hasFilters}
                onOpenChapter={(path) => void openChapter(path)}
                onPreviewChapter={setPreviewPath}
                onToggleChapter={toggleChapterSelection}
                onToggleExpand={toggleExpanded}
                onToggleCollapsedGroup={toggleCollapsedGroup}
                onLoadChildren={loadMoreChildren}
                onOpenContextMenu={openChapterContextMenu}
              />
            </section>
          ) : (
            <section className="surface-panel overflow-hidden" aria-label="章节列表">
              <div>
                {visibleChapters.map((chapter) => {
                  const history = index.historyByPath.get(normalizeLibraryPathId(chapter.path));
                  const status = getChapterStatus(history);
                  const isSelected = selectedChapterPaths.has(chapter.path);
                  return (
                    <div
                      key={chapter.path}
                      onContextMenu={(event) => openChapterContextMenu(chapter.path, event)}
                      className={`border-b border-white/6 px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "bg-blue-500/10"
                          : "hover:bg-white/[0.025]"
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
                            className={`inline-flex w-12 shrink-0 items-center justify-center rounded py-1 text-xs ${statusClass[status]}`}
                          >
                            {statusLabel[status]}
                          </span>
                          <button type="button" disabled={openingPath !== null} onClick={() => void openChapter(chapter.path)} aria-label={`阅读 ${chapter.name}`} className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400">
                            <div className="truncate text-sm font-medium">
                              {chapter.name}
                            </div>
                            <div className="mt-1 truncate text-xs text-gray-500">
                              {chapter.relativePath} · {chapter.imageCount} 张
                            </div>
                          </button>
                        </div>
                        <span className="hidden shrink-0 text-xs text-gray-400 sm:inline-flex">
                          {getHistoryProgressText(history)}
                        </span>
                        <button type="button" onClick={() => setPreviewPath(chapter.path)} aria-label={`预览 ${chapter.name}`} className="ui-button shrink-0 text-xs text-blue-200">预览</button>
                      </div>
                    </div>
                  );
                })}

                {filteredChapters.length === 0 && (
                  <div className="px-6 py-12 text-center text-sm text-gray-400">
                    <p>没有匹配的章节</p>
                    <button type="button" onClick={() => updateFilters("", "all")} className="ui-button mt-3 text-blue-300">清除搜索和筛选</button>
                  </div>
                )}

                {visibleChapters.length < filteredChapters.length && (
                  <button
                    onClick={() =>
                      setBrowse((current) => ({ ...current, visibleChapterCount: current.visibleChapterCount + CHAPTER_PAGE_SIZE }))
                    }
                    className="ui-button mx-auto my-3 block text-gray-300"
                  >
                    继续加载章节 ({visibleChapters.length} / {filteredChapters.length})
                  </button>
                )}
              </div>
            </section>
          )}
        </>
      ) : null}

      {previewChapter && <ChapterPreview key={previewChapter.path} chapter={previewChapter} history={index?.historyByPath.get(normalizeLibraryPathId(previewChapter.path))} onClose={() => setPreviewPath(null)} onRead={() => { setPreviewPath(null); void openChapter(previewChapter.path); }} />}

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
