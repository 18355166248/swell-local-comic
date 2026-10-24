import { useId, useState } from "react";
import type { ComicFile } from "../types";
import { ChevronLeftIcon, ChevronRightIcon, NextChapterIcon } from "./Icons";
import { parsePageNumber } from "../utils/readerUtils";

interface NavigationProps {
  files: ComicFile[];
  currentIndex: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onGoToPage: (index: number) => void;
  onLoadNextFolder?: () => void;
  onPageOverview: () => void;
  onBackToLibrary: () => void;
  onToggleSettings: () => void;
  settingsOpen: boolean;
  immersive: boolean;
}

const railButton = "flex h-9 w-10 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10 focus-visible:outline-blue-400";

function PageJump({ total, onGoToPage }: { total: number; onGoToPage: (index: number) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const errorId = useId();

  const handleJump = () => {
    const page = parsePageNumber(value, total);
    if (page === null) {
      setError(`请输入 1–${total} 的整数页码`);
      return;
    }
    onGoToPage(page);
    setValue("");
    setError("");
  };

  return (
    <form noValidate onSubmit={(event) => { event.preventDefault(); handleJump(); }} className="flex flex-col items-center gap-1 border-t border-white/10 pt-2">
      <input
        type="text"
        inputMode="numeric"
        aria-label="跳转页码"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        value={value}
        onChange={(event) => { setValue(event.target.value); setError(""); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setValue("");
            setError("");
          }
        }}
        placeholder="页码"
        autoComplete="off"
        className="w-10 rounded-md border border-white/20 bg-[#0e1721] px-0 py-1 text-center text-xs text-white placeholder:text-slate-500"
      />
      <button type="submit" className="rounded-md px-1 py-1 text-[11px] text-slate-300 hover:bg-white/10">跳转</button>
      {error && <span id={errorId} role="alert" className="w-12 break-words text-center text-[10px] leading-4 text-amber-300">{error}</span>}
    </form>
  );
}

export default function Navigation({
  files,
  currentIndex,
  onPrevPage,
  onNextPage,
  onGoToPage,
  onLoadNextFolder,
  onPageOverview,
  onBackToLibrary,
  onToggleSettings,
  settingsOpen,
  immersive,
}: NavigationProps) {
  if (files.length === 0) return null;

  return (
    <nav aria-label="分页导航" className="reader-side-rail reader-rail-left text-xs">
      <button type="button" onClick={onPrevPage} aria-label="上一页" title="上一页（← / A）" className={railButton}>
        <ChevronLeftIcon size={19} aria-hidden="true" />
      </button>
      <span aria-live="polite" className="w-full border-y border-white/10 py-2 text-center font-medium tabular-nums text-slate-100">{currentIndex + 1}<span className="block text-[10px] font-normal text-slate-500">/ {files.length}</span></span>
      <button type="button" onClick={onNextPage} aria-label="下一页" title="下一页（→ / D）" className={railButton}>
        <ChevronRightIcon size={19} aria-hidden="true" />
      </button>
      <button type="button" onClick={onPageOverview} aria-label="图片页览" title="图片页览" className={`${railButton} text-[11px]`}>页览</button>
      <PageJump key={files[0].path} total={files.length} onGoToPage={onGoToPage} />
      {onLoadNextFolder && (
        <button type="button" onClick={onLoadNextFolder} aria-label="下一章" title="打开下一章" className={`${railButton} border-t border-white/10`}>
          <NextChapterIcon size={18} aria-hidden="true" />
        </button>
      )}
      {immersive && <button type="button" onClick={onToggleSettings} aria-label="阅读设置" aria-expanded={settingsOpen} aria-controls="reader-settings" title="阅读设置" className={`${railButton} border-t border-white/10 text-[11px]`}>设置</button>}
      {immersive && <button type="button" onClick={onBackToLibrary} aria-label="返回书库" title="返回书库" className={`${railButton} text-[11px]`}>书库</button>}
    </nav>
  );
}
