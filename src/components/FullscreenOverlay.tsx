import { useState } from "react";

interface FullscreenOverlayProps {
  progressText: string;
  fullscreenImageFit: "original" | "fit";
  onFullscreenImageFitChange?: (mode: "original" | "fit") => void;
  onToggleFullscreen: () => void;
}

export function FullscreenOverlay({
  progressText,
  fullscreenImageFit,
  onFullscreenImageFitChange,
  onToggleFullscreen,
}: FullscreenOverlayProps) {
  const [showExit, setShowExit] = useState(false);

  return (
    <div
      className="absolute top-4 left-4 flex flex-col gap-2 z-20"
      onMouseEnter={() => setShowExit(true)}
      onMouseLeave={() => setShowExit(false)}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <div className="bg-black/60 px-4 py-2 rounded-lg text-white text-sm">
          {progressText}
        </div>
        {onFullscreenImageFitChange && (
          <button
            onClick={() =>
              onFullscreenImageFitChange(
                fullscreenImageFit === "original" ? "fit" : "original",
              )
            }
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              fullscreenImageFit === "fit"
                ? "bg-blue-600 text-white"
                : "bg-black/60 text-white hover:bg-black/80"
            }`}
            title={
              fullscreenImageFit === "original"
                ? "当前：原图大小，点击适应屏幕"
                : "当前：适应屏幕，点击原图大小"
            }
          >
            {fullscreenImageFit === "original" ? "适应屏幕" : "原图"}
          </button>
        )}
      </div>
      {showExit && (
        <button
          onClick={onToggleFullscreen}
          onBlur={() => setShowExit(false)}
          className="bg-black/60 hover:bg-black/80 px-4 py-2 rounded-lg text-white text-sm flex items-center gap-2 transition-colors"
          title="退出全屏 (ESC)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          退出全屏
        </button>
      )}
    </div>
  );
}
