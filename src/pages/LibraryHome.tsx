import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { LibraryItem, ReadingHistory } from "../types";
import { selectFolder } from "../utils/fileUtils";
import {
  addOrUpdateLibraryItem,
  deleteLibraryItem,
  getLibraryItems,
  touchLibraryItem,
} from "../utils/libraryStorage";
import {
  getHistoryProgressText,
  getRecentHistoryForLibrary,
  isPathInsideRoot,
} from "../utils/libraryUtils";
import { getAllHistory } from "../utils/historyUtils";
import { useLibraryChapterCounts } from "../hooks/useLibraryChapterCounts";
import { useReadingSessionEntry } from "../hooks/useReadingSessionEntry";

function WorkIcon() {
  return (
    <div className="work-icon">
      <img src="/app-icon.png" alt="" className="h-12 w-12" />
    </div>
  );
}

function ReadingProgress({ history }: { history?: ReadingHistory }) {
  const progress = history && history.totalFiles > 0
    ? Math.min(100, (history.currentIndex + 1) / history.totalFiles * 100)
    : 0;

  return (
    <div className="flex items-center gap-3">
      <div
        className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-[#273546]"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-blue-400"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-slate-400">
        {getHistoryProgressText(history)}
      </span>
    </div>
  );
}

export default function LibraryHome() {
  const navigate = useNavigate();
  const [items, setItems] = useState<LibraryItem[]>(getLibraryItems);
  const [histories, setHistories] = useState<ReadingHistory[]>(getAllHistory);
  const { counts, retry } = useLibraryChapterCounts(items);
  const [actionPending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const {
    openingPath,
    error: readingError,
    run: openReading,
    clearError,
    isMounted,
  } = useReadingSessionEntry();
  const pending = actionPending ?? openingPath;
  const error = actionError || readingError?.message || "";
  const setError = (message: string) => {
    if (!isMounted()) return;
    setActionError(message);
    if (!message) clearError();
  };
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const latest = histories
    .filter((history) => items.some((item) => isPathInsideRoot(history.folderPath, item.rootPath)))
    .sort((a, b) => b.lastReadTime - a.lastReadTime)[0];
  const latestLibrary = latest && items
    .filter((item) => isPathInsideRoot(latest.folderPath, item.rootPath))
    .sort((a, b) => b.rootPath.length - a.rootPath.length)[0];
  const visible = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return items
      .filter((item) => terms.every((term) => `${item.name} ${item.rootPath}`.toLocaleLowerCase().includes(term)))
      .sort((a, b) => sort === "name"
        ? a.name.localeCompare(b.name, "zh-CN", { numeric: true })
        : (getRecentHistoryForLibrary(histories, b.rootPath)?.lastReadTime ?? b.lastOpenedAt)
          - (getRecentHistoryForLibrary(histories, a.rootPath)?.lastReadTime ?? a.lastOpenedAt));
  }, [items, histories, query, sort]);

  const addFolder = async (temporary: boolean) => {
    if (pending) return;
    setPending("add");
    setError("");
    try {
      const folder = await selectFolder();
      if (!folder || !isMounted()) return;
      if (temporary) {
        for (const key of ["continueReading", "directRestore", "restoreState", "comicChapterSequence"])
          sessionStorage.removeItem(key);
        sessionStorage.setItem("openComicFolder", JSON.stringify(folder));
        navigate("/viewer?openFolder=true");
      } else {
        setItems(addOrUpdateLibraryItem({ name: folder.name, rootPath: folder.path }));
        setHistories(getAllHistory());
      }
    } catch (cause) {
      setError(`打开目录失败：${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      if (isMounted()) setPending(null);
    }
  };

  const openLibrary = (item: LibraryItem) => {
    touchLibraryItem(item.id);
    navigate(`/library?root=${encodeURIComponent(item.id)}`);
  };
  const continueReading = (history: ReadingHistory) => {
    if (pending) return;
    setError("");
    return openReading(history, { libraries: items });
  };

  const remove = (item: LibraryItem) => {
    if (confirm(`从书库移除「${item.name}」？本地文件和阅读历史会保留。`))
      setItems(deleteLibraryItem(item.id));
  };

  return (
    <main className="app-page">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-heading">我的书库</h1>
          <p className="mt-2 text-base text-slate-400">
            管理本地漫画，接着上次的进度阅读。
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="ui-button-primary"
            disabled={Boolean(pending)}
            onClick={() => void addFolder(false)}
          >
            <span aria-hidden="true" className="text-xl leading-none">＋</span>
            添加作品
          </button>
          <button
            type="button"
            className="ui-button"
            disabled={Boolean(pending)}
            onClick={() => void addFolder(true)}
          >
            临时打开
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          <span>{error}</span>
          <button
            type="button"
            aria-label="关闭错误提示"
            onClick={() => setError("")}
            className="px-2"
          >
            ×
          </button>
        </div>
      )}

      {latest && (
        <section className="continue-band mb-6" aria-label="最近阅读">
          <WorkIcon />
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-medium text-blue-300">接着读</p>
            <h2 className="truncate text-xl font-semibold">
              {latestLibrary?.name ?? latest.folderName}
            </h2>
            <p className="mt-1 truncate text-sm text-slate-400">
              {latest.folderName} · 第 {latest.currentIndex + 1} / {latest.totalFiles} 页
            </p>
          </div>
          <div className="hidden w-1/3 lg:block">
            <ReadingProgress history={latest} />
          </div>
          <button
            type="button"
            className="ui-button-primary"
            disabled={Boolean(pending)}
            onClick={() => void continueReading(latest)}
          >
            {pending === latest.folderPath ? "正在打开…" : "继续阅读"}
            <span aria-hidden="true">›</span>
          </button>
        </section>
      )}

      {items.length > 0 && (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <label className="relative min-w-48 flex-1">
              <span className="sr-only">搜索作品名称或路径</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索作品名称或路径"
                className="ui-input w-full"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">作品排序</span>
              <select
                className="ui-input"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="recent">最近阅读</option>
                <option value="name">名称排序</option>
              </select>
            </label>
            <div role="group" aria-label="作品显示方式" className="flex gap-1">
              <button
                type="button"
                className="ui-button"
                aria-label="卡片显示"
                aria-pressed={layout === "grid"}
                onClick={() => setLayout("grid")}
                style={layout === "grid"
                  ? { borderColor: "#4596ff", color: "#82b8ff" }
                  : undefined}
              >
                ▦
              </button>
              <button
                type="button"
                className="ui-button"
                aria-label="列表显示"
                aria-pressed={layout === "list"}
                onClick={() => setLayout("list")}
                style={layout === "list"
                  ? { borderColor: "#4596ff", color: "#82b8ff" }
                  : undefined}
              >
                ☰
              </button>
            </div>
          </div>

          <h2 className="mb-4 text-base font-semibold">
            {query ? "搜索结果" : "全部作品"}
            <span className="ml-3 font-normal text-slate-500">{visible.length}</span>
          </h2>

          {visible.length === 0 && (
            <div className="py-16 text-center text-sm text-slate-400">
              没有匹配的作品。
              <button
                type="button"
                onClick={() => setQuery("")}
                className="ml-3 text-blue-300 hover:underline"
              >
                清除搜索
              </button>
            </div>
          )}

          <div className={layout === "grid"
            ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
            : "flex flex-col gap-3"}
          >
            {visible.map((item) => {
              const recent = getRecentHistoryForLibrary(histories, item.rootPath);
              const scan = counts[item.id];

              return (
                <article
                  key={item.id}
                  className={`work-card ${layout === "list" ? "flex flex-wrap items-center gap-5" : ""}`}
                >
                  <div
                    className={`flex min-w-0 items-start gap-4 ${layout === "list" ? "min-w-60 flex-1" : ""}`}
                  >
                    <WorkIcon />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-semibold">
                        <button
                          type="button"
                          onClick={() => openLibrary(item)}
                          className="text-left hover:text-blue-300"
                        >
                          {item.name}
                        </button>
                      </h3>
                      <p
                        className="mt-1 truncate text-sm text-slate-400 selectable"
                        title={item.rootPath}
                      >
                        {item.rootPath}
                      </p>
                      <div className="mt-2 text-xs text-slate-400">
                        {scan?.status === "error" ? (
                          <button
                            type="button"
                            title={scan.error}
                            className="text-amber-300 hover:underline"
                            onClick={() => retry(item.id)}
                          >
                            扫描失败 · 重试
                          </button>
                        ) : scan?.status === "ready" ? `共 ${scan.count} 章` : "正在扫描章节…"}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`移除${item.name}`}
                      title="从书库移除"
                      onClick={() => remove(item)}
                      className="-mr-1 rounded px-2 text-lg text-slate-500 hover:bg-white/5 hover:text-red-300"
                    >
                      ×
                    </button>
                  </div>

                  <div className={layout === "list" ? "w-52" : "mt-5"}>
                    <p className="mb-2 truncate text-xs text-slate-400">
                      {recent ? `最近：${recent.folderName}` : "尚未开始阅读"}
                    </p>
                    <ReadingProgress history={recent} />
                  </div>

                  <div className={`flex gap-2 ${layout === "grid" ? "mt-5" : ""}`}>
                    <button
                      type="button"
                      className="ui-button flex-1"
                      onClick={() => openLibrary(item)}
                    >
                      预览目录
                    </button>
                    {recent && (
                      <button
                        type="button"
                        className="ui-button-primary flex-1"
                        disabled={Boolean(pending)}
                        onClick={() => void continueReading(recent)}
                      >
                        {pending === recent.folderPath ? "正在打开…" : "继续阅读"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {items.length === 0 && (
        <div className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-700 text-center">
          <WorkIcon />
          <h2 className="text-lg font-semibold">把第一部作品加入书库</h2>
          <p className="max-w-sm px-4 text-sm leading-6 text-slate-400">
            选择包含章节的作品目录，即可预览目录和保存阅读进度。
          </p>
          <button
            type="button"
            className="ui-button-primary"
            disabled={Boolean(pending)}
            onClick={() => void addFolder(false)}
          >
            添加作品
          </button>
        </div>
      )}
    </main>
  );
}
