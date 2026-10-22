import { useEffect, useRef, useState } from "react";
import type { ComicChapter, ReadingHistory } from "../types";
import { loadImageFile, scanImageFiles } from "../utils/fileUtils";
import { getHistoryProgressText } from "../utils/libraryUtils";

interface Props {
  chapter: ComicChapter;
  history?: ReadingHistory;
  onClose: () => void;
  onRead: () => void;
}

export default function ChapterPreview({ chapter, history, onClose, onRead }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    attempt: number;
    pages: { url: string; name: string; number: number }[];
    error: string | null;
  } | null>(null);
  const loading = result?.attempt !== attempt;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const load = async () => {
      try {
        const files = (await scanImageFiles(chapter.path)).slice(0, 3);
        if (cancelled) return;
        const pages = [];
        let failed = 0;
        for (const [pageIndex, file] of files.entries()) {
          if (cancelled) return;
          try {
            const url = await loadImageFile(file);
            if (cancelled) {
              URL.revokeObjectURL(url);
              return;
            }
            urls.push(url);
            const image = new Image();
            image.src = url;
            await image.decode();
            if (cancelled) return;
            pages.push({ url, name: file.name, number: pageIndex + 1 });
          } catch {
            failed += 1;
          }
        }
        if (!cancelled) {
          setResult({ attempt, pages, error: failed ? `${failed} 张图片未能加载，可重试或直接进入阅读。` : files.length ? null : "此章节已没有图片，请刷新目录。" });
        }
      } catch (error) {
        if (!cancelled) setResult({ attempt, pages: [], error: typeof error === "string" ? error : "预览加载失败，请检查目录是否仍可访问。" });
      }
    };
    void load();
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [chapter.path, attempt]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="chapter-preview-title"
      onClose={() => { if (!dialogRef.current?.open) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="m-auto max-h-[88vh] w-[min(900px,calc(100vw-32px))] overflow-y-auto rounded-2xl border border-white/15 bg-[#111821] p-0 text-white shadow-2xl backdrop:bg-black/75"
    >
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#111821] p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-blue-300">章节预览 · 前 3 张</p>
          <h2 id="chapter-preview-title" className="mt-2 break-words text-xl font-semibold">{chapter.name}</h2>
          <p className="mt-1 break-words text-xs text-gray-400">{chapter.relativePath} · {chapter.imageCount} 张 · {getHistoryProgressText(history)}</p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-blue-400">关闭预览</button>
      </header>
      <div className="p-5" aria-busy={loading}>
        {loading ? (
          <p role="status" className="py-20 text-center text-sm text-gray-400">正在加载章节图片…</p>
        ) : (
          <>
            {result?.error && <div role="alert" className="mb-4 rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200">{result.error}<button type="button" onClick={() => setAttempt((value) => value + 1)} className="ml-3 underline underline-offset-4">重新加载</button></div>}
            <div className="grid items-start gap-4 sm:grid-cols-3">
              {result?.pages.map((page) => (
                <figure key={page.url} className="min-w-0">
                  <img src={page.url} alt={`${chapter.name} · ${page.name}`} decoding="async" className="max-h-[52vh] w-full rounded-lg bg-black/25 object-contain" />
                  <figcaption className="mt-2 truncate text-center text-xs text-gray-400" title={page.name}>{page.number} · {page.name}</figcaption>
                </figure>
              ))}
            </div>
          </>
        )}
      </div>
      <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#111821] p-5">
        <span className="text-xs text-gray-400">预览不会改变阅读进度 · Esc 关闭</span>
        <button type="button" onClick={onRead} className="rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-medium hover:bg-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">{history ? "继续阅读" : "开始阅读"}</button>
      </footer>
    </dialog>
  );
}
