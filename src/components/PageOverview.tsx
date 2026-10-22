import { useEffect, useRef, useState } from "react";
import type { ComicFile } from "../types";
import { loadImageThumbnail } from "../utils/fileUtils";
import { getPageRange, parsePageNumber } from "../utils/readerUtils";

interface Props {
  files: ComicFile[];
  imageUrls: string[];
  currentIndex: number;
  onGoToPage: (index: number) => void;
  onClose: () => void;
}

function ThumbnailGrid({ files, imageUrls, start, currentIndex, onGoToPage }: Omit<Props, "onClose"> & { start: number }) {
  const [thumbnails, setThumbnails] = useState<Record<number, string | null>>({});
  const [attempt, setAttempt] = useState(0);
  const end = Math.min(start + 12, files.length);
  useEffect(() => {
    let cancelled = false;
    const ownedUrls: string[] = [];
    const load = async () => {
      // Three decodes at a time; never load the entire chapter just to browse pages.
      for (let offset = start; offset < end; offset += 3) {
        if (cancelled) return;
        await Promise.all(files.slice(offset, Math.min(offset + 3, end)).map(async (file, relative) => {
          const index = offset + relative;
          let url = imageUrls[index];
          if (!url) {
            try {
              url = await loadImageThumbnail(file);
              if (cancelled) { URL.revokeObjectURL(url); return; }
              ownedUrls.push(url);
            } catch {
              if (!cancelled) setThumbnails((current) => ({ ...current, [index]: null }));
              return;
            }
          }
          if (!cancelled) setThumbnails((current) => ({ ...current, [index]: url }));
        }));
      }
    };
    void load();
    return () => { cancelled = true; ownedUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [files, imageUrls, start, end, attempt]);

  return (
    <>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {files.slice(start, end).map((file, offset) => {
          const index = start + offset;
          const url = thumbnails[index];
          return <button key={file.path} type="button" onClick={() => onGoToPage(index)} aria-label={`跳到第 ${index + 1} 页`} aria-current={currentIndex === index ? "page" : undefined} className={`min-w-0 rounded-xl border p-2 text-left focus-visible:outline-2 focus-visible:outline-blue-300 ${currentIndex === index ? "border-blue-400 bg-blue-500/15" : "border-white/10 hover:border-blue-400/50"}`}>
            <div className="flex h-32 items-center justify-center overflow-hidden rounded-md bg-black/25 sm:h-40">
              {url ? <img src={url} alt="" onError={() => setThumbnails((current) => ({ ...current, [index]: null }))} className="h-full w-full object-contain" decoding="async" /> : <span className="px-2 text-center text-xs text-gray-400">{url === null ? "缩略图不可用，仍可跳页" : "加载预览…"}</span>}
            </div>
            <p className="mt-2 text-xs text-gray-200">第 {index + 1} 页{currentIndex === index ? " · 当前" : ""}</p>
            <p className="mt-1 truncate text-[11px] text-gray-500" title={file.name}>{file.name}</p>
          </button>;
        })}
      </div>
      {Object.values(thumbnails).some((url) => url === null) && <button type="button" onClick={() => { setThumbnails({}); setAttempt((value) => value + 1); }} className="mt-3 text-xs text-blue-300 underline underline-offset-4">重新加载缩略图</button>}
    </>
  );
}

export default function PageOverview({ files, imageUrls, currentIndex, onGoToPage, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [rangeIndex, setRangeIndex] = useState(currentIndex);
  const [jump, setJump] = useState("");
  const [invalidJump, setInvalidJump] = useState(false);
  const range = getPageRange(rangeIndex, files.length);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={dialogRef} aria-labelledby="page-overview-title" onClose={() => { if (!dialogRef.current?.open) onClose(); }} className="m-auto max-h-[90vh] w-[min(780px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-white/15 bg-[#111821] p-0 text-white shadow-2xl backdrop:bg-black/75">
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[#111821] p-4">
      <div><h2 id="page-overview-title" className="font-semibold">图片页览</h2><p className="mt-1 text-xs text-gray-400">当前第 {currentIndex + 1} / {files.length} 页 · 点击缩略图跳转</p></div>
      <button type="button" onClick={onClose} className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10">关闭页览</button>
    </header>
    <div className="p-4"><ThumbnailGrid key={range.start} files={files} imageUrls={imageUrls} start={range.start} currentIndex={currentIndex} onGoToPage={(index) => { onClose(); onGoToPage(index); }} /></div>
    <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#111821] p-4">
      <div className="flex items-center gap-3 text-xs">
        <button type="button" disabled={range.start === 0} onClick={() => setRangeIndex(range.start - 12)} className="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-30">上一组</button>
        <span className="tabular-nums text-gray-400">{range.start + 1}–{range.end} / {files.length}</span>
        <button type="button" disabled={range.end >= files.length} onClick={() => setRangeIndex(range.end)} className="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-30">下一组</button>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); const index = parsePageNumber(jump, files.length); if (index === null) { setInvalidJump(true); return; } onClose(); onGoToPage(index); }} className="flex items-center gap-2">
        <input type="text" inputMode="numeric" aria-label="跳转页码" aria-invalid={invalidJump} value={jump} onChange={(event) => { setJump(event.target.value); setInvalidJump(false); }} placeholder={`1–${files.length}`} className="w-24 rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-blue-400" />
        <button type="submit" className="rounded-lg bg-blue-500 px-3 py-2 text-sm hover:bg-blue-400">跳转</button>
        {invalidJump && <span role="alert" className="text-xs text-amber-200">请输入 1–{files.length} 的整数</span>}
      </form>
    </footer>
  </dialog>;
}
