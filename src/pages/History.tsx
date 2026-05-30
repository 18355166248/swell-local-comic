import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { ReadingHistory } from "../types";
import {
  clearAllHistory,
  deleteHistory,
  getAllHistory,
} from "../utils/historyUtils";

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));

  if (days > 0) return `${days} 天前`;
  if (hours > 0) return `${hours} 小时前`;
  if (minutes > 0) return `${minutes} 分钟前`;
  return "刚刚";
}

function getProgress(history: ReadingHistory) {
  if (history.viewMode === "scroll" && history.scrollPosition !== undefined) {
    if (history.scrollHeight && history.scrollHeight > 0) {
      const progress = Math.min(
        Math.round((history.scrollPosition / history.scrollHeight) * 100),
        100,
      );
      return {
        label: `滚动 ${progress}%`,
        detail: `${Math.round(history.scrollPosition)}px`,
        progress,
      };
    }

    return {
      label: "滚动阅读",
      detail: `${Math.round(history.scrollPosition)}px`,
      progress: 0,
    };
  }

  if (history.totalFiles <= 0) {
    return {
      label: "未开始",
      detail: "0 / 0",
      progress: 0,
    };
  }

  const current = history.currentIndex + 1;
  const progress = Math.round((current / history.totalFiles) * 100);
  return {
    label: `${current} / ${history.totalFiles}`,
    detail: `${progress}%`,
    progress,
  };
}

function splitHistory(histories: ReadingHistory[]) {
  return {
    featured: histories.slice(0, 3),
    rest: histories.slice(3),
  };
}

export default function History() {
  const navigate = useNavigate();
  const [histories, setHistories] = useState<ReadingHistory[]>(() =>
    getAllHistory(),
  );

  const loadHistories = useCallback(() => {
    setHistories(getAllHistory());
  }, []);

  const handleDelete = (folderPath: string, folderName: string) => {
    if (confirm(`确定要删除 "${folderName}" 的阅读历史吗？`)) {
      deleteHistory(folderPath);
      loadHistories();
    }
  };

  const handleClearAll = () => {
    if (confirm("确定要清空所有阅读历史吗？")) {
      clearAllHistory();
      loadHistories();
    }
  };

  const handleContinueReading = (history: ReadingHistory) => {
    sessionStorage.setItem("continueReading", JSON.stringify(history));
    if (history.folderPath) {
      sessionStorage.setItem("currentFolderPath", history.folderPath);
    }
    navigate("/viewer?fromContinueReading=true");
  };

  const { featured, rest } = useMemo(() => splitHistory(histories), [histories]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="mb-8 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-50">阅读历史</h1>
          <p className="mt-1 text-sm text-gray-400">
            先继续最近读到的章节，再回头整理旧记录。
          </p>
        </div>
        {histories.length > 0 && (
          <button
            onClick={handleClearAll}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-100 transition-colors hover:bg-red-500/20"
          >
            清空全部
          </button>
        )}
      </section>

      {histories.length === 0 ? (
        <section className="rounded-3xl border border-white/8 bg-white/[0.03] px-8 py-20 text-center">
          <div className="mx-auto max-w-md">
            <div className="text-lg text-gray-200">还没有最近阅读</div>
            <p className="mt-2 text-sm text-gray-500">
              从书库挑一个章节开始读，这里会自动记住你停下来的位置。
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              返回书库
            </button>
          </div>
        </section>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-100">最近继续读</h2>
              <p className="mt-1 text-sm text-gray-500">
                保留最近 3 条，优先回到刚看到一半的内容。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featured.map((history) => {
                const progress = getProgress(history);
                return (
                  <article
                    key={`${history.folderPath}-${history.lastReadTime}`}
                    className="rounded-3xl border border-white/8 bg-[#111821] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-wide text-blue-300/80">
                          最近阅读
                        </div>
                        <h3 className="mt-2 truncate text-lg font-semibold text-gray-50">
                          {history.folderName}
                        </h3>
                        <div
                          className="mt-2 truncate text-xs text-gray-500"
                          title={history.folderPath}
                        >
                          {history.folderPath}
                        </div>
                      </div>
                      <div className="shrink-0 rounded-full bg-white/[0.04] px-2.5 py-1 text-xs text-gray-300">
                        {formatTime(history.lastReadTime)}
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-300">{progress.label}</span>
                        <span className="text-gray-500">{progress.detail}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white/[0.06]">
                        <div
                          className="h-2 rounded-full bg-blue-500 transition-all"
                          style={{ width: `${Math.max(progress.progress, 6)}%` }}
                        />
                      </div>
                      {history.currentFileName && (
                        <div className="mt-3 truncate text-sm text-gray-400">
                          当前图片：{history.currentFileName}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <button
                        onClick={() => handleDelete(history.folderPath, history.folderName)}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/[0.08] hover:text-white"
                      >
                        删除
                      </button>
                      <button
                        onClick={() => handleContinueReading(history)}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                      >
                        继续阅读
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {rest.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-100">历史列表</h2>
              <p className="mt-1 text-sm text-gray-500">
                所有记录按最近阅读时间排序，方便继续或清理。
              </p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/8 bg-white/[0.03]">
              <div className="grid grid-cols-[minmax(0,2.1fr)_minmax(180px,1fr)_140px_180px] gap-4 border-b border-white/8 px-5 py-3 text-xs uppercase tracking-wide text-gray-500">
                <div>章节</div>
                <div>进度</div>
                <div>最近阅读</div>
                <div>操作</div>
              </div>

              <div className="divide-y divide-white/6">
                {rest.map((history) => {
                  const progress = getProgress(history);
                  return (
                    <div
                      key={`${history.folderPath}-${history.lastReadTime}`}
                      className="grid grid-cols-[minmax(0,2.1fr)_minmax(180px,1fr)_140px_180px] gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-100">
                          {history.folderName}
                        </div>
                        <div
                          className="mt-1 truncate text-xs text-gray-500"
                          title={history.folderPath}
                        >
                          {history.folderPath}
                        </div>
                        {history.currentFileName && (
                          <div className="mt-2 truncate text-xs text-gray-400">
                            当前图片：{history.currentFileName}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-gray-200">{progress.label}</span>
                          <span className="shrink-0 text-xs text-gray-500">
                            {progress.detail}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/[0.06]">
                          <div
                            className="h-2 rounded-full bg-blue-500 transition-all"
                            style={{ width: `${Math.max(progress.progress, 6)}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-sm text-gray-400">
                        {formatTime(history.lastReadTime)}
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDelete(history.folderPath, history.folderName)}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/[0.08] hover:text-white"
                        >
                          删除
                        </button>
                        <button
                          onClick={() => handleContinueReading(history)}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                        >
                          继续阅读
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
          )}
        </div>
      )}
    </main>
  );
}
