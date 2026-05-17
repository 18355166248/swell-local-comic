import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { LibraryItem, ReadingHistory } from "../types";
import { selectFolder, scanComicLibrary } from "../utils/fileUtils";
import {
  addOrUpdateLibraryItem,
  deleteLibraryItem,
  getLibraryItems,
  touchLibraryItem,
} from "../utils/libraryStorage";
import {
  getHistoryProgressText,
  getRecentHistoryForLibrary,
} from "../utils/libraryUtils";
import { getAllHistory } from "../utils/historyUtils";

export default function LibraryHome() {
  const navigate = useNavigate();
  const [items, setItems] = useState<LibraryItem[]>(() => getLibraryItems());
  const [histories, setHistories] = useState<ReadingHistory[]>(() =>
    getAllHistory(),
  );
  const [chapterCounts, setChapterCounts] = useState<Record<string, number>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadCounts = async () => {
      for (const item of items) {
        if (chapterCounts[item.id] !== undefined) continue;
        try {
          const result = await scanComicLibrary(item.rootPath);
          if (!cancelled) {
            setChapterCounts((current) => ({
              ...current,
              [item.id]: result.chapters.length,
            }));
          }
        } catch {
          if (!cancelled) {
            setChapterCounts((current) => ({ ...current, [item.id]: 0 }));
          }
        }
      }
    };

    loadCounts();
    return () => {
      cancelled = true;
    };
  }, [items, chapterCounts]);

  const handleAddLibrary = async () => {
    setIsAddMenuOpen(false);
    setIsAdding(true);
    try {
      const folder = await selectFolder();
      if (!folder) return;
      setItems(addOrUpdateLibraryItem({ name: folder.name, rootPath: folder.path }));
      setHistories(getAllHistory());
    } finally {
      setIsAdding(false);
    }
  };

  const handleTemporaryOpen = async () => {
    setIsAddMenuOpen(false);
    setIsAdding(true);
    try {
      const folder = await selectFolder();
      if (!folder) return;
      sessionStorage.setItem("openComicFolder", JSON.stringify(folder));
      navigate("/viewer?openFolder=true");
    } finally {
      setIsAdding(false);
    }
  };

  const openLibrary = (item: LibraryItem) => {
    touchLibraryItem(item.id);
    navigate(`/library?root=${encodeURIComponent(item.id)}`);
  };

  const continueRecent = (history: ReadingHistory) => {
    sessionStorage.setItem("continueReading", JSON.stringify(history));
    sessionStorage.setItem("currentFolderPath", history.folderPath);
    navigate("/viewer?fromContinueReading=true");
  };

  const handleDelete = (item: LibraryItem) => {
    if (!confirm(`确定要从书库移除「${item.name}」吗？`)) return;
    setItems(deleteLibraryItem(item.id));
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="mb-6 rounded-2xl border border-white/8 bg-white/[0.03] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-xs font-medium uppercase tracking-[0.24em] text-blue-200/80">
              Local Library
            </div>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              把作品根目录收进书库，用目录预览挑章节；临时打开保留给一次性阅读，不和书库管理混在一起。
            </p>
          </div>

          <div className="relative">
            <button
              onClick={() => setIsAddMenuOpen((open) => !open)}
              disabled={isAdding}
              className="rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAdding ? "处理中..." : "添加目录"}
            </button>

            {isAddMenuOpen && (
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-white/8 bg-[#10161d] shadow-2xl">
                <button
                  onClick={handleAddLibrary}
                  className="block w-full px-4 py-3 text-left text-sm text-gray-100 hover:bg-white/6"
                >
                  添加作品目录
                </button>
                <button
                  onClick={handleTemporaryOpen}
                  className="block w-full border-t border-white/8 px-4 py-3 text-left text-sm text-gray-100 hover:bg-white/6"
                >
                  临时打开图片文件夹
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03]">
          <div className="text-center">
            <h2 className="mt-4 text-xl font-semibold">还没有漫画作品</h2>
            <p className="mt-2 text-sm text-gray-400">
              添加一个作品根目录后，会在这里显示成卡片。
            </p>
            <button
              onClick={handleAddLibrary}
              disabled={isAdding}
              className="mt-5 rounded-xl bg-blue-500 px-5 py-2 text-sm font-medium transition-colors hover:bg-blue-400 disabled:opacity-60"
            >
              添加作品目录
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const recent = getRecentHistoryForLibrary(histories, item.rootPath);
            return (
              <article
                key={item.id}
                onClick={() => openLibrary(item)}
                className="group cursor-pointer rounded-2xl border border-white/8 bg-[#111821] p-5 transition-colors hover:border-blue-500/60 hover:bg-[#15202b]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">{item.name}</h2>
                    <p className="mt-1 truncate text-xs text-gray-500" title={item.rootPath}>
                      {item.rootPath}
                    </p>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(item);
                    }}
                    className="rounded-lg px-2 py-1 text-sm text-gray-500 opacity-0 transition-opacity hover:bg-white/8 hover:text-red-300 group-hover:opacity-100"
                    title="移除"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-black/20 p-3">
                    <div className="text-xs text-gray-400">可读章节</div>
                    <div className="mt-1 text-xl font-semibold">
                      {chapterCounts[item.id] ?? "..."}
                    </div>
                  </div>
                  <div className="rounded-xl bg-black/20 p-3">
                    <div className="text-xs text-gray-400">最近进度</div>
                    <div className="mt-1 truncate font-medium">
                      {getHistoryProgressText(recent)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-gray-400">
                    {recent ? `最近：${recent.folderName}` : "点击预览目录"}
                  </span>
                  {recent && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        continueRecent(recent);
                      }}
                      className="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-white transition-colors hover:bg-blue-400"
                    >
                      继续
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
