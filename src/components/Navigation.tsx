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
}

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
    <form noValidate onSubmit={(event) => { event.preventDefault(); handleJump(); }} className="flex flex-wrap items-center gap-2">
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
        className="ui-input h-8 w-16 px-2 py-1 text-center text-sm tabular-nums"
      />
      <button type="submit" className="ui-button h-8 px-3 py-1 text-sm">跳转</button>
      {error && <p id={errorId} role="alert" className="w-full text-xs text-amber-300">{error}</p>}
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
}: NavigationProps) {
  if (files.length === 0) return null;
  const start = Math.max(0, currentIndex - 2);
  const end = Math.min(files.length, currentIndex + 3);

  return (
    <nav aria-label="分页导航" className="shrink-0 border-t border-white/[0.07] bg-[#0c1117] px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={onPrevPage}
          aria-label="上一页"
          className="ui-button flex h-8 items-center justify-center gap-1.5 px-2.5 py-1"
          title="上一页，第一页时打开上一章最后一张（← / A）"
        >
          <ChevronLeftIcon size={16} aria-hidden="true" />
          <span className="hidden sm:inline">上一页</span>
        </button>

        <div className="hidden items-center gap-1 xl:flex" role="group" aria-label="附近页码">
          {files.slice(start, end).map((file, index) => {
            const page = start + index;
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => onGoToPage(page)}
                aria-label={`跳到第 ${page + 1} 页`}
                aria-current={page === currentIndex ? "page" : undefined}
                className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm tabular-nums transition-colors ${page === currentIndex ? "bg-blue-600 font-medium text-white" : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"}`}
              >
                {page + 1}
              </button>
            );
          })}
        </div>

        <span aria-live="polite" aria-atomic="true" className="shrink-0 whitespace-nowrap text-xs tabular-nums text-slate-400">{currentIndex + 1} / {files.length} 页</span>
        <PageJump key={files[0].path} total={files.length} onGoToPage={onGoToPage} />

        <button
          type="button"
          onClick={onNextPage}
          aria-label="下一页"
          className="ui-button flex h-8 items-center justify-center gap-1.5 px-2.5 py-1"
          title="下一页，最后一页时打开下一章（→ / D）"
        >
          <span className="hidden sm:inline">下一页</span>
          <ChevronRightIcon size={16} aria-hidden="true" />
        </button>

        {onLoadNextFolder && (
          <button type="button" onClick={onLoadNextFolder} aria-label="下一章" title="直接打开下一章" className="ui-button flex h-8 items-center justify-center gap-1.5 px-2.5 py-1">
            <span className="hidden sm:inline">下一章</span>
            <NextChapterIcon size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </nav>
  );
}
