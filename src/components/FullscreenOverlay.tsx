import type { PageImageFit } from "../utils/pageImageLayout";

interface FullscreenOverlayProps {
  progressText: string;
  fit: PageImageFit;
  onFitChange?: (mode: PageImageFit) => void;
  onToggleFullscreen: () => void;
  scrollMode?: boolean;
}

export function FullscreenOverlay({
  progressText,
  fit,
  onFitChange,
  onToggleFullscreen,
  scrollMode = false,
}: FullscreenOverlayProps) {
  const modes: Array<{ value: PageImageFit; label: string }> = scrollMode
    ? [{ value: "contain", label: "适应宽度" }, { value: "original", label: "原图宽度" }]
    : [{ value: "height", label: "铺满高度" }, { value: "contain", label: "完整显示" }, { value: "original", label: "原图大小" }];

  return (
    <div className="reader-fullscreen-chrome">
      <button type="button" className="reader-top-hotspot" aria-label="显示全屏操作栏" title="鼠标移至顶部显示全屏操作栏" />
      <div className="reader-fullscreen-panel flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2">
        <span className="rounded-lg bg-black/65 px-3 py-2 text-sm text-white" aria-live="polite">{progressText}</span>
        {onFitChange && (
          <div role="group" aria-label="全屏图片显示方式" className="flex flex-wrap gap-1 rounded-lg bg-black/65 p-1">
            {modes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                aria-pressed={fit === mode.value}
                onClick={() => onFitChange(mode.value)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${fit === mode.value ? "bg-blue-600 text-white" : "text-slate-200 hover:bg-white/15"}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={onToggleFullscreen} className="rounded-lg bg-black/65 px-3 py-2 text-sm text-white hover:bg-black/80" title="退出全屏 (Esc)">退出全屏</button>
      </div>
    </div>
  );
}
