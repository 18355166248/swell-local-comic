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
  onOpenChapter: (path: string) => void;
  onPreviewChapter: (path: string) => void;
  onToggleChapter: (path: string) => void;
  onToggleExpand: (path: string) => void;
  onToggleCollapsedGroup: (path: string) => void;
  onOpenContextMenu: (path: string, event: MouseEvent<HTMLElement>) => void;
  level?: number;
}

function DirectoryNode({
  node,
  index,
  selectedPaths,
  expandedPaths,
  revealedCollapsedGroups,
  onOpenChapter,
  onPreviewChapter,
  onToggleChapter,
  onToggleExpand,
  onToggleCollapsedGroup,
  onOpenContextMenu,
  level = 0,
}: DirectoryNodeProps) {
  const [childLimit, setChildLimit] = useState(100);
  const history = node.readable ? index.historyByPath.get(normalizeLibraryPathId(node.path)) : undefined;
  const progress = index.progressByPath.get(node.path);
  const status = getChapterStatus(history);
  const isSelected = selectedPaths.has(node.path);
  const isExpanded = expandedPaths.has(node.path);
  const hasChildren = node.children.length > 0;
  const collapsedGroupKey = `${node.path}::leading-read`;
  const leadingReadCount = hasChildren
    ? getLeadingFullyReadChildCount(node.children, index.progressByPath)
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
        } ${node.readable ? "hover:border-blue-500/70" : ""}`}
        style={{ marginLeft: `${Math.min(level, 5) * 14}px` }}
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
              className={`inline-flex h-6 w-16 shrink-0 items-center justify-center rounded px-2 py-1 text-xs ${statusClass[status]}`}
            >
              {statusLabel[status]}
            </span>
          ) : (
            null
          )}

          <button type="button" onClick={() => node.readable ? onOpenChapter(node.path) : onToggleExpand(node.path)} className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400" aria-label={node.readable ? `阅读 ${node.name}` : `${isExpanded ? "折叠" : "展开"} ${node.name}`} aria-expanded={hasChildren && !node.readable ? isExpanded : undefined}>
            <div className="flex items-center gap-2">
              <span className="truncate font-medium" title={node.path}>{node.name}</span>
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
            <button type="button" onClick={() => onPreviewChapter(node.path)} aria-label={`预览 ${node.name}`} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-blue-200 hover:border-blue-400/50 hover:bg-blue-500/10 focus-visible:outline-2 focus-visible:outline-blue-400">预览</button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-2">
          {leadingReadCount > 0 && (
            <button
              type="button"
              className="flex items-center justify-between gap-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-2 text-left text-sm text-emerald-200 transition-colors hover:border-emerald-700/60 hover:bg-emerald-950/30"
              style={{ marginLeft: `${Math.min(level + 1, 5) * 14}px`, width: `calc(100% - ${Math.min(level + 1, 5) * 14}px)` }}
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
              onOpenChapter={onOpenChapter}
              onPreviewChapter={onPreviewChapter}
              onToggleChapter={onToggleChapter}
              onToggleExpand={onToggleExpand}
              onToggleCollapsedGroup={onToggleCollapsedGroup}
              onOpenContextMenu={onOpenContextMenu}
              level={level + 1}
            />
          ))}
          {visibleChildren.length > childLimit && <button type="button" onClick={() => setChildLimit((value) => value + 100)} className="mx-auto block rounded-xl border border-white/10 px-4 py-2.5 text-sm text-blue-200 hover:bg-blue-500/10">加载更多目录（{Math.min(childLimit, visibleChildren.length)} / {visibleChildren.length}）</button>}
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
  const [statusFilter, setStatusFilter] = useState<ChapterStatus | "all">("all");
  const [view, setView] = useState<"tree" | "list">("tree");
  const [refreshCount, setRefreshCount] = useState(0);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
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
    setScan(null);
    setPreviewPath(null);
    setQuery("");
    setStatusFilter("all");

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
          setError(typeof scanError === "string" ? scanError : scanError instanceof Error ? scanError.message : "扫描目录失败。");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [rootId, refreshCount]);

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
  const showList = isSearching || statusFilter !== "all" || view === "list";

  useEffect(() => {
    setSelectedChapterPaths(new Set());
    setExpandedPaths(
      scan && index ? buildAutoExpandedPaths(scan.tree, index.progressByPath, true) : new Set(),
    );
    setRevealedCollapsedGroups(new Set());
    setVisibleChapterCount(CHAPTER_PAGE_SIZE);
    setContextMenu(null);
  }, [index, scan]);

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

    const sequence = scan.chapters.map((candidate) => ({
      name: candidate.name,
      path: candidate.path,
    }));
    sessionStorage.setItem("comicChapterSequence", JSON.stringify(sequence));

    const history = index?.historyByPath.get(normalizeLibraryPathId(chapter.path));
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
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
      <div className="mb-4">
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
        <p className="mt-1 truncate text-sm text-gray-400" title={item?.rootPath}>{item?.rootPath}</p>
      </div>

      {isLoading ? (
        <div role="status" className="rounded-2xl border border-white/8 bg-[#111821] p-8 text-center text-gray-300">
          正在扫描目录...
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-red-900/60 bg-red-950/30 p-8 text-center text-red-200">
          <p>{error}</p>
          <button type="button" onClick={() => setRefreshCount((value) => value + 1)} className="mt-4 rounded-xl border border-red-400/40 px-4 py-2 text-sm hover:bg-red-500/10">重新扫描</button>
        </div>
      ) : scan && scan.chapters.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-[#111821] p-8 text-center text-gray-300">
          未找到可阅读章节。请确认目录中包含 JPG、PNG、GIF、WebP 或 BMP 图片。
          <button type="button" onClick={() => setRefreshCount((value) => value + 1)} className="mx-auto mt-4 block rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5">重新扫描</button>
        </div>
      ) : scan && index ? (
        <>
          <section aria-label="阅读概览" className="mb-3 rounded-2xl border border-blue-400/15 bg-gradient-to-br from-blue-500/10 to-[#111821] p-4">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-sm font-medium text-gray-200">阅读进度</h2>
                  <span className="text-xs text-gray-400">已读 {index.totals.read} / {index.totals.total} 章</span>
                </div>
                <div role="progressbar" aria-label="已读章节比例" aria-valuenow={index.totals.read} aria-valuemin={0} aria-valuemax={index.totals.total} className="mt-3 h-1.5 max-w-lg overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-blue-400 transition-[width]" style={{width: `${index.totals.total ? index.totals.read / index.totals.total * 100 : 0}%`}} />
                </div>
                <p className="mt-3 text-xs text-gray-400">{index.totals.reading} 章阅读中 · {index.totals.total - index.totals.read - index.totals.reading} 章未读 · 共 {scan.chapters.reduce((sum, chapter) => sum + chapter.imageCount, 0).toLocaleString()} 张图片</p>
              </div>
              <div className="flex max-w-full items-center gap-3">
                {suggestedChapter ? (
                  <button type="button" onClick={() => openChapter(suggestedChapter.path)} className="min-w-0 rounded-xl bg-blue-500 px-5 py-2.5 text-left text-sm font-medium hover:bg-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
                    <span className="block">{index.historyByPath.has(normalizeLibraryPathId(suggestedChapter.path)) ? "继续阅读" : "开始下一章"}</span>
                    <span className="mt-0.5 block max-w-48 truncate text-xs font-normal text-blue-100" title={suggestedChapter.relativePath}>{suggestedChapter.name}</span>
                  </button>
                ) : <span className="text-sm text-emerald-300">已读完全部章节</span>}
                <button type="button" onClick={() => setRefreshCount((value) => value + 1)} title="重新扫描磁盘中的章节" className="rounded-xl border border-white/15 px-3 py-2.5 text-sm text-gray-300 hover:bg-white/5">刷新目录</button>
              </div>
            </div>
          </section>
          <section className="mb-3 rounded-2xl border border-white/8 bg-[#111821] p-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <input
                  type="search"
                  aria-label="搜索章节名或路径"
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
                  : `共 ${scan.chapters.length} 章`}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-2">
              <div role="group" aria-label="按阅读状态筛选" className="flex flex-wrap gap-1.5">
                {(["all", "unread", "reading", "read"] as const).map((status) => {
                  const counts = { all: index.totals.total, unread: index.totals.total - index.totals.read - index.totals.reading, reading: index.totals.reading, read: index.totals.read };
                  return <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => { setStatusFilter(status); setVisibleChapterCount(CHAPTER_PAGE_SIZE); }} className={`rounded-lg px-3 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-blue-400 ${statusFilter === status ? "bg-blue-500/20 text-blue-100" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}`}>{status === "all" ? "全部" : statusLabel[status]} <span className="ml-1 tabular-nums opacity-75">{counts[status]}</span></button>;
                })}
              </div>
              <div role="group" aria-label="浏览方式" className="flex rounded-lg border border-white/10 p-1">
                <button type="button" aria-pressed={!showList} onClick={() => { setView("tree"); setQuery(""); setStatusFilter("all"); }} className={`rounded-md px-3 py-1.5 text-xs ${!showList ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>目录</button>
                <button type="button" aria-pressed={showList} onClick={() => setView("list")} className={`rounded-md px-3 py-1.5 text-xs ${showList ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>列表</button>
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

          {!showList ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">目录结构</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    点击章节名进入阅读，点击预览查看前 3 张图片。
                  </p>
                </div>
              </div>
              <DirectoryNode
                node={scan.tree}
                index={index}
                selectedPaths={selectedChapterPaths}
                expandedPaths={expandedPaths}
                revealedCollapsedGroups={revealedCollapsedGroups}
                onOpenChapter={openChapter}
                onPreviewChapter={setPreviewPath}
                onToggleChapter={toggleChapterSelection}
                onToggleExpand={toggleExpanded}
                onToggleCollapsedGroup={toggleCollapsedGroup}
                onOpenContextMenu={openChapterContextMenu}
              />
            </section>
          ) : (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold" aria-live="polite">章节列表 <span className="ml-2 text-sm font-normal text-gray-400">{filteredChapters.length} 章</span></h2>
                <p className="mt-1 text-sm text-gray-400">
                  点击章节名进入阅读，也可先预览图片。
                </p>
              </div>
              <div className="space-y-2">
                {visibleChapters.map((chapter) => {
                  const history = index.historyByPath.get(normalizeLibraryPathId(chapter.path));
                  const status = getChapterStatus(history);
                  const isSelected = selectedChapterPaths.has(chapter.path);
                  return (
                    <div
                      key={chapter.path}
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
                          <button type="button" onClick={() => openChapter(chapter.path)} aria-label={`阅读 ${chapter.name}`} className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400">
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
                        <button type="button" onClick={() => setPreviewPath(chapter.path)} aria-label={`预览 ${chapter.name}`} className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs text-blue-200 hover:border-blue-400/50 hover:bg-blue-500/10 focus-visible:outline-2 focus-visible:outline-blue-400">预览</button>
                      </div>
                    </div>
                  );
                })}

                {filteredChapters.length === 0 && (
                  <div className="rounded-2xl border border-white/8 bg-[#111821] p-6 text-center text-sm text-gray-500">
                    <p>没有匹配的章节</p>
                    <button type="button" onClick={() => { setQuery(""); setStatusFilter("all"); }} className="mt-3 text-blue-300 hover:text-blue-200">清除搜索和筛选</button>
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

      {previewChapter && <ChapterPreview key={previewChapter.path} chapter={previewChapter} history={index?.historyByPath.get(normalizeLibraryPathId(previewChapter.path))} onClose={() => setPreviewPath(null)} onRead={() => { setPreviewPath(null); openChapter(previewChapter.path); }} />}

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
