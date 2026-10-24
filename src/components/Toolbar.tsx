import { useEffect, useId, useState } from "react";
import type { ViewMode } from "../types";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FullscreenIcon,
} from "./Icons";

interface ToolbarProps {
  onBeforeLeave?: () => void;
  onClose?: () => void;
  onFolderSelect: () => void;
  onPrevChapter?: () => void;
  onNextChapter?: () => void;
  hasPrevChapter?: boolean;
  hasNextChapter?: boolean;
  currentChapterNumber?: number;
  totalChapters?: number;
  prevChapterName?: string;
  nextChapterName?: string;
  folderName?: string;
  folderPath?: string;
  currentFileName?: string;
  currentIndex: number;
  totalFiles: number;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  viewMode: ViewMode;
  onToggleViewMode: () => void;
  imageWidth: number;
  onImageWidthChange: (width: number) => void;
  scrollRatio: number;
  onScrollRatioChange: (ratio: number) => void;
  imagesPerGroup: number;
  onImagesPerGroupChange: (count: number) => void;
  onToggleFullscreen?: () => void;
}

interface NumericSettingProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
}

function NumericSetting({ label, unit, value, min, max, step, onCommit }: NumericSettingProps) {
  const id = useId();

  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-xs text-slate-400">{label}</label>
      <div className="flex items-center gap-2">
        <input
          key={value}
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          defaultValue={value}
          onBlur={(event) => {
            const next = event.currentTarget.valueAsNumber;
            const committed = Number.isFinite(next)
              ? Math.max(min, Math.min(max, Math.round(next)))
              : value;
            event.currentTarget.value = String(committed);
            if (committed !== value) onCommit(committed);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              event.currentTarget.value = String(value);
              event.currentTarget.blur();
            }
          }}
          className="ui-input w-[84px] px-2 py-1.5 text-right text-sm tabular-nums"
        />
        <span className="w-4 text-xs text-slate-500">{unit}</span>
      </div>
    </div>
  );
}

const summaryClass = "flex cursor-pointer list-none items-center justify-between py-4 text-sm font-medium text-slate-100 [&::-webkit-details-marker]:hidden";
const detailsClass = "group border-b border-white/[0.07]";

export default function Toolbar({
  onBeforeLeave,
  onClose,
  onFolderSelect,
  onPrevChapter,
  onNextChapter,
  hasPrevChapter = false,
  hasNextChapter = false,
  currentChapterNumber,
  totalChapters,
  prevChapterName,
  nextChapterName,
  folderName,
  folderPath,
  currentFileName,
  currentIndex,
  totalFiles,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  viewMode,
  onToggleViewMode,
  imageWidth,
  onImageWidthChange,
  scrollRatio,
  onScrollRatioChange,
  imagesPerGroup,
  onImagesPerGroupChange,
  onToggleFullscreen,
}: ToolbarProps) {
  const hasFiles = totalFiles > 0;
  const currentPage = hasFiles ? Math.min(totalFiles, Math.max(1, currentIndex + 1)) : 0;
  const [isPathExpanded, setIsPathExpanded] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");
  const scrollRatioId = useId();
  const pathId = useId();

  useEffect(() => {
    if (copyState === "idle") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const handleCopyPath = async () => {
    if (!folderPath) return;
    try {
      await navigator.clipboard.writeText(folderPath);
      setCopyState("done");
    } catch (error) {
      console.error("复制路径失败:", error);
      setCopyState("error");
    }
  };

  const shortcuts = [
    ["← / A", viewMode === "scroll" ? "向上滚动" : "上一页"],
    ["→ / D / 空格", viewMode === "scroll" ? "向下滚动" : "下一页"],
    ["W / ↑ · S / ↓", "向上 / 向下滚动"],
    ["PageUp / Down", viewMode === "scroll" ? "滚动" : "翻页"],
    ["Home / End", viewMode === "scroll" ? "顶部 / 底部" : "首页 / 尾页"],
    ["+ / − · 0", "缩放 / 重置"],
    ["M", "切换模式"],
    ["F / Esc", "全屏 / 退出"],
  ];

  return (
    <aside aria-label="阅读设置" className="flex h-full w-full max-w-[280px] flex-col border-r border-white/[0.07] bg-[#0c1117] text-sm text-slate-200">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
        <h2 className="font-medium text-slate-100">阅读设置</h2>
        {onClose && <button type="button" onClick={onClose} aria-label="收起阅读设置" className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10">收起</button>}
        <button
          type="button"
          onClick={() => { onBeforeLeave?.(); onFolderSelect(); }}
          className="ui-button px-2.5 py-1.5 text-xs"
        >
          打开目录
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <details open className={detailsClass}>
          <summary className={summaryClass} onKeyDown={(event) => event.stopPropagation()}>
            <span>章节</span>
            <span className="flex items-center gap-2 text-xs font-normal text-slate-500">
              {currentChapterNumber && totalChapters ? `${currentChapterNumber} / ${totalChapters}` : ""}
              <ChevronDownIcon size={14} aria-hidden="true" className="transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="space-y-3 pb-4">
            <div>
              <p className="truncate font-medium text-slate-100" title={folderName}>
                {folderName || "尚未打开目录"}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>阅读位置</span>
                <span className="tabular-nums text-slate-300">{hasFiles ? `${currentPage} / ${totalFiles} 页` : "未打开"}</span>
              </div>
              {hasFiles && (
                <div
                  role="progressbar"
                  aria-label="章节阅读进度"
                  aria-valuemin={0}
                  aria-valuemax={totalFiles}
                  aria-valuenow={currentPage}
                  className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]"
                >
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${currentPage / totalFiles * 100}%` }} />
                </div>
              )}
              {currentFileName && <p className="mt-2 truncate text-xs text-slate-500" title={currentFileName}>{currentFileName}</p>}
            </div>

            {Boolean(totalChapters) && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={onPrevChapter}
                  disabled={!hasPrevChapter}
                  title={prevChapterName || "没有上一章节"}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeftIcon size={16} aria-hidden="true" className="shrink-0 text-slate-500" />
                  <span className="min-w-0"><span className="block text-xs text-slate-500">上一章</span><span className="block truncate">{prevChapterName || "已到第一章"}</span></span>
                </button>
                <button
                  type="button"
                  onClick={onNextChapter}
                  disabled={!hasNextChapter}
                  title={nextChapterName || "没有下一章节"}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRightIcon size={16} aria-hidden="true" className="shrink-0 text-slate-500" />
                  <span className="min-w-0"><span className="block text-xs text-slate-500">下一章</span><span className="block truncate">{nextChapterName || "已到最后一章"}</span></span>
                </button>
              </div>
            )}

            {folderPath && (
              <div className="text-xs">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setIsPathExpanded((value) => !value)} aria-expanded={isPathExpanded} aria-controls={pathId} className="py-1 text-slate-400 hover:text-slate-100">{isPathExpanded ? "收起路径" : "查看路径"}</button>
                  <button type="button" onClick={handleCopyPath} className="py-1 text-slate-400 hover:text-slate-100">复制路径</button>
                  <span role="status" className={copyState === "error" ? "text-amber-300" : "text-blue-300"}>{copyState === "done" ? "已复制" : copyState === "error" ? "复制失败" : ""}</span>
                </div>
                <p id={pathId} hidden={!isPathExpanded} className="mt-1 break-all leading-relaxed text-slate-500">{folderPath}</p>
              </div>
            )}
          </div>
        </details>

        {hasFiles && (
          <details open className={detailsClass}>
            <summary className={summaryClass} onKeyDown={(event) => event.stopPropagation()}>
              <span>显示</span>
              <ChevronDownIcon size={14} aria-hidden="true" className="text-slate-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-4 pb-4">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/[0.04] p-1" role="group" aria-label="阅读模式">
                {(["scroll", "page"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={viewMode === mode}
                    onClick={() => { if (viewMode !== mode) onToggleViewMode(); }}
                    className={`rounded-md px-3 py-1.5 text-sm transition-colors ${viewMode === mode ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"}`}
                  >
                    {mode === "scroll" ? "滚动" : "分页"}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">缩放</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={onZoomOut} aria-label="缩小" className="ui-button h-8 w-8 p-0 text-base">−</button>
                  <button type="button" onClick={onResetZoom} title="重置缩放（0）" className="min-w-14 rounded-md px-1 py-1.5 text-xs tabular-nums text-slate-300 hover:bg-white/[0.05]">{Math.round(zoom * 100)}%</button>
                  <button type="button" onClick={onZoomIn} aria-label="放大" className="ui-button h-8 w-8 p-0 text-base">+</button>
                </div>
              </div>

              {viewMode === "scroll" && (
                <div className="space-y-3 border-t border-white/[0.07] pt-4">
                  <NumericSetting label="图片宽度" unit="px" value={imageWidth} min={200} max={2000} step={50} onCommit={onImageWidthChange} />
                  <NumericSetting label="每组图片" unit="张" value={imagesPerGroup} min={1} max={20} step={1} onCommit={onImagesPerGroupChange} />
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <label htmlFor={scrollRatioId} className="text-slate-400">滚动步长</label>
                      <span className="tabular-nums text-slate-300">{Math.round(scrollRatio * 100)}%</span>
                    </div>
                    <input id={scrollRatioId} type="range" min={15} max={100} step={5} value={Math.round(scrollRatio * 100)} onChange={(event) => onScrollRatioChange(Number(event.target.value) / 100)} className="block w-full cursor-pointer accent-blue-500" />
                  </div>
                </div>
              )}

              {onToggleFullscreen && (
                <button type="button" onClick={onToggleFullscreen} className="ui-button flex w-full items-center justify-center gap-2 py-2" title="全屏看图（F），Esc 退出">
                  <FullscreenIcon size={15} aria-hidden="true" />全屏查看
                </button>
              )}
            </div>
          </details>
        )}

        <details className={detailsClass}>
          <summary className={summaryClass} onKeyDown={(event) => event.stopPropagation()}>
            <span>快捷键</span>
            <ChevronDownIcon size={14} aria-hidden="true" className="text-slate-500 transition-transform group-open:rotate-180" />
          </summary>
          <dl className="space-y-3 pb-4 text-xs">
            {shortcuts.map(([keys, action]) => (
              <div key={keys} className="flex items-center justify-between gap-2">
                <dt className="font-mono text-slate-400">{keys}</dt>
                <dd className="text-right text-slate-500">{action}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </aside>
  );
}
