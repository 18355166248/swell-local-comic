import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { ReadingHistory } from "../types";
import { clearAllHistory, deleteHistory, getAllHistory } from "../utils/historyUtils";
import { getChapterStatus, getHistoryProgressText } from "../utils/libraryUtils";
import { useReadingSessionEntry } from "../hooks/useReadingSessionEntry";

function formatTime(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)} 天前`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)} 小时前`;
  if (minutes > 0) return `${minutes} 分钟前`;
  return "刚刚";
}

type HistoryFilter = "all" | "reading" | "read";
const filterLabels: Record<HistoryFilter, string> = { all: "全部", reading: "阅读中", read: "已读" };

export default function History() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [histories, setHistories] = useState<ReadingHistory[]>(() => getAllHistory());
  const { openingPath, error, run: handleContinueReading, clearError } = useReadingSessionEntry();
  const query = searchParams.get("q") ?? "";
  const rawFilter = searchParams.get("status");
  const statusFilter: HistoryFilter = rawFilter === "reading" || rawFilter === "read" ? rawFilter : "all";

  const updateFilters = (nextQuery: string, nextStatus: HistoryFilter) => {
    const next = new URLSearchParams(searchParams);
    if (nextQuery) next.set("q", nextQuery); else next.delete("q");
    if (nextStatus !== "all") next.set("status", nextStatus); else next.delete("status");
    setSearchParams(next, { replace: true });
  };

  const counts = useMemo(() => ({
    all: histories.length,
    reading: histories.filter((history) => getChapterStatus(history) === "reading").length,
    read: histories.filter((history) => getChapterStatus(history) === "read").length,
  }), [histories]);

  const filteredHistories = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return histories.filter((history) => {
      if (statusFilter !== "all" && getChapterStatus(history) !== statusFilter) return false;
      const text = `${history.folderName} ${history.folderPath} ${history.currentFileName ?? ""}`.toLocaleLowerCase();
      return terms.every((term) => text.includes(term));
    });
  }, [histories, query, statusFilter]);

  const handleDelete = (history: ReadingHistory) => {
    if (!confirm(`确定要删除「${history.folderName}」的阅读历史吗？`)) return;
    deleteHistory(history.folderPath);
    setHistories(getAllHistory());
    if (error?.path === history.folderPath) clearError();
  };

  const handleClearAll = () => {
    if (!confirm("确定要清空所有阅读历史吗？")) return;
    clearAllHistory();
    setHistories(getAllHistory());
    clearError();
  };

  return (
    <main className="app-page space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-label">阅读记录</p>
          <h1 className="page-heading mt-1">回到上次停下的位置</h1>
          <p className="mt-2 text-sm text-gray-400">{histories.length > 0 ? `共 ${histories.length} 条记录，按最近阅读排序。` : "阅读进度会自动保存在这里。"}</p>
        </div>
        {histories.length > 0 && <button type="button" onClick={handleClearAll} disabled={openingPath !== null} className="ui-button text-gray-400 hover:text-red-200">清空记录</button>}
      </section>

      {histories.length === 0 ? (
        <section className="surface-panel px-6 py-20 text-center">
          <h2 className="text-lg font-medium text-gray-100">还没有阅读记录</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-400">从书库挑选一个章节，读到的位置会自动保存，下次可以从这里继续。</p>
          <button type="button" onClick={() => navigate("/")} className="ui-button ui-button-primary mt-5">前往书库</button>
        </section>
      ) : (
        <section className="surface-panel overflow-hidden" aria-label="阅读历史列表">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 p-4">
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="按阅读状态筛选">
              {(Object.keys(filterLabels) as HistoryFilter[]).map((status) => (
                <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => updateFilters(query, status)} className={`rounded-lg px-3 py-2 text-sm transition-colors ${statusFilter === status ? "bg-blue-500/15 text-blue-200" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}`}>
                  {filterLabels[status]} <span className="ml-1 text-xs tabular-nums opacity-70">{counts[status]}</span>
                </button>
              ))}
            </div>
            <div className="relative min-w-52 flex-1 sm:max-w-80">
              <label className="sr-only" htmlFor="history-search">搜索章节、目录或图片</label>
              <input id="history-search" type="search" value={query} onChange={(event) => updateFilters(event.target.value, statusFilter)} placeholder="搜索章节、目录或图片" className="ui-input w-full" />
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-white/6 px-4 py-2.5 text-xs text-gray-500" aria-live="polite">
            <span>{filteredHistories.length} 条记录</span>
            <span>最近阅读优先</span>
          </div>

          {filteredHistories.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-sm text-gray-300">没有匹配的阅读记录</p>
              <p className="mt-2 text-xs text-gray-500">试试更短的关键词，或查看其他阅读状态。</p>
              <button type="button" onClick={() => updateFilters("", "all")} className="ui-button mt-4">清除搜索和筛选</button>
            </div>
          ) : (
            <ul className="divide-y divide-white/6">
              {filteredHistories.map((history) => {
                const status = getChapterStatus(history);
                const opening = openingPath === history.folderPath;
                const rowError = error?.path === history.folderPath ? error.message : null;
                return (
                  <li key={history.folderPath} className="px-4 py-4 transition-colors hover:bg-white/[0.02]">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                      <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <h2 className="min-w-0 truncate text-sm font-medium text-gray-100" title={history.folderName}>{history.folderName}</h2>
                          <span className={`shrink-0 text-xs ${status === "read" ? "text-emerald-400/80" : "text-blue-300/80"}`}>{status === "read" ? "已读" : "阅读中"}</span>
                        </div>
                        <p className="mt-1.5 truncate text-xs text-gray-500" title={history.folderPath}>{history.folderPath}</p>
                        {history.currentFileName && <p className="mt-1 truncate text-xs text-gray-400" title={history.currentFileName}>停在 {history.currentFileName}</p>}
                      </div>
                      <div className="min-w-24 flex-1 sm:flex-none">
                        <p className="text-sm tabular-nums text-gray-300">{getHistoryProgressText(history)}</p>
                        <time dateTime={new Date(history.lastReadTime).toISOString()} title={new Date(history.lastReadTime).toLocaleString()} className="mt-1.5 block text-xs text-gray-500">{formatTime(history.lastReadTime)}</time>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button type="button" onClick={() => handleDelete(history)} disabled={openingPath !== null} aria-label={`删除 ${history.folderName} 的阅读记录`} className="ui-button text-gray-500 hover:text-red-200">删除</button>
                        <button type="button" onClick={() => void handleContinueReading(history)} disabled={openingPath !== null} aria-label={`${status === "read" ? "打开章节" : "继续阅读"} ${history.folderName}`} aria-busy={opening} className="ui-button ui-button-primary min-w-24">{opening ? "正在打开…" : status === "read" ? "打开章节" : "继续阅读"}</button>
                      </div>
                    </div>
                    {rowError && <p role="alert" className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-amber-200">{rowError} <span className="text-amber-200/70">可以重试打开，或返回书库重新扫描。</span></p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
