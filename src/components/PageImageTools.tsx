import { FullscreenIcon } from "./Icons";
import type { PageImageFit } from "../utils/pageImageLayout";

interface PageImageToolsProps {
  fit: PageImageFit;
  onFitChange: (fit: PageImageFit) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToggleFullscreen: () => void;
}

const railButton = "flex h-9 w-10 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10 disabled:opacity-35";

export default function PageImageTools({
  fit,
  onFitChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleFullscreen,
}: PageImageToolsProps) {
  return (
    <div role="toolbar" aria-label="图片显示工具" className="reader-side-rail reader-rail-right text-xs">
      <button type="button" onClick={onZoomIn} disabled={zoom >= 3} aria-label="放大图片" title="放大（+）" className={`${railButton} text-lg`}>+</button>
      <button type="button" onClick={onResetZoom} aria-label="重置缩放" title="重置缩放（0）" className="w-full border-y border-white/10 py-2 text-center text-[11px] tabular-nums text-slate-300 hover:text-white">{Math.round(zoom * 100)}%</button>
      <button type="button" onClick={onZoomOut} disabled={zoom <= 0.5} aria-label="缩小图片" title="缩小（−）" className={`${railButton} text-lg`}>−</button>
      <div role="group" aria-label="图片显示方式" className="flex w-full flex-col items-center border-t border-white/10 pt-2">
        {([
          ["height", "高度", "铺满可用高度；较宽图片可左右拖动"],
          ["contain", "完整", "完整显示图片"],
          ["original", "原图", "按原图大小显示"],
        ] as const).map(([mode, label, title]) => (
          <button
            key={mode}
            type="button"
            onClick={() => onFitChange(mode)}
            aria-pressed={fit === mode}
            title={title}
            className={`w-10 rounded-md py-1.5 text-[11px] ${fit === mode ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
          >{label}</button>
        ))}
      </div>
      <button type="button" onClick={onToggleFullscreen} aria-label="全屏看图" title="全屏看图（F）" className={`${railButton} border-t border-white/10`}>
        <FullscreenIcon size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
