import { useRef, useCallback, useState } from "react";
import type { ViewMode } from "../types";
import { useImageGroups } from "../hooks/useImageGroups";
import { useScrollKeyboard } from "../hooks/useScrollKeyboard";
import { useScrollPosition } from "../hooks/useScrollPosition";
import { useCurrentImageDetection } from "../hooks/useCurrentImageDetection";

interface ImageViewerProps {
  imageUrl: string;
  currentFileName?: string;
  zoom: number;
  onWheel: (e: React.WheelEvent) => void;
  viewMode: ViewMode;
  imageWidth: number;
  imageUrls: string[];
  files: Array<{ name: string; path: string }>;
  scrollRatio?: number; // 滚动距离比例，默认0.8（80%）
  scrollPosition?: number; // 初始滚动位置
  onScrollPositionChange?: (position: number, height: number) => void; // 滚动位置变化回调，包含位置和总高度
  onLoadNextFolder?: () => void; // 加载下一文件夹（底部点击下键/S键/D键触发）
  onCurrentImageChange?: (index: number) => void; // 当前可见图片索引变化回调
  isLoading?: boolean; // 是否正在加载
  imagesPerGroup?: number; // 每组图片数量，默认1（每张图片单独显示），可以配置成5（每5张合成一张）
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  currentIndex?: number;
  totalFiles?: number;
  scrollPositionRatio?: number; // 滚动模式下的滚动进度 0-1
  fullscreenImageFit?: "original" | "fit"; // 全屏时图片显示：原图大小 / 适应屏幕
  onFullscreenImageFitChange?: (mode: "original" | "fit") => void;
}

export default function ImageViewer({
  imageUrl,
  currentFileName,
  zoom,
  onWheel,
  viewMode,
  imageWidth,
  imageUrls,
  files,
  scrollRatio = 0.6,
  scrollPosition,
  onScrollPositionChange,
  onLoadNextFolder,
  onCurrentImageChange,
  isLoading = false,
  imagesPerGroup = 1,
  isFullscreen = false,
  onToggleFullscreen,
  currentIndex = 0,
  totalFiles = 0,
  scrollPositionRatio,
  fullscreenImageFit = "original",
  onFullscreenImageFitChange,
}: ImageViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showExitFullscreen, setShowExitFullscreen] = useState(false);
  /** 判定「已到底部」的阈值：距离底部小于等于此像素视为到底 */
  const AT_BOTTOM_THRESHOLD = 5;

  // 使用自定义 hooks
  const imageGroups = useImageGroups(
    imageUrls,
    files,
    imagesPerGroup,
    viewMode
  );

  const { handleScrollUp, handleScrollDown } = useScrollKeyboard({
    viewMode,
    scrollRatio,
    scrollContainerRef,
    onLoadNextFolderAtBottom: onLoadNextFolder,
    isLoading,
  });

  useScrollPosition({
    viewMode,
    scrollPosition,
    onScrollPositionChange,
    imageUrls,
    isLoading,
    scrollContainerRef,
  });

  useCurrentImageDetection({
    viewMode,
    imageUrls,
    imagesPerGroup,
    onCurrentImageChange,
    imageWidth,
    zoom,
    scrollContainerRef,
  });

  // 向下滚动：若已在底部则加载下一文件夹，否则执行滚动（需用户主动点击/S键触发）
  const handleScrollDownClick = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      handleScrollDown();
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    if (
      onLoadNextFolder &&
      distanceToBottom <= AT_BOTTOM_THRESHOLD &&
      !isLoading
    ) {
      onLoadNextFolder();
    } else {
      handleScrollDown();
    }
  }, [handleScrollDown, onLoadNextFolder, isLoading]);

  if (!imageUrl && imageUrls.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="text-6xl mb-4">📚</div>
          <p>请先选择包含漫画图片的文件夹</p>
          <p className="text-sm mt-2">支持格式：JPG, PNG, GIF, WebP, BMP</p>
        </div>
      </div>
    );
  }

  // 滚动模式：显示所有图片
  if (viewMode === "scroll") {
    return (
      <div className="h-full relative">
        {/* 非全屏时的全屏快捷按钮 */}
        {!isFullscreen && onToggleFullscreen && totalFiles > 0 && (
          <button
            onClick={onToggleFullscreen}
            className="absolute top-4 right-16 z-20 p-2 rounded-lg bg-black/40 hover:bg-black/60 text-white transition-colors"
            title="全屏看图"
            aria-label="全屏"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        )}
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto overflow-x-hidden scroll-mode-container"
          onWheel={isLoading ? undefined : onWheel}
          style={{
            scrollBehavior: "smooth",
            pointerEvents: isLoading ? "none" : "auto",
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          <div className="flex flex-col items-center py-4 space-y-0">
            {imageGroups.map((group, groupIndex) => (
              <div
                key={groupIndex}
                className="flex w-full"
                style={{
                  width: isFullscreen && fullscreenImageFit === "fit"
                    ? "100%"
                    : `${imageWidth * zoom}px`,
                  maxWidth: "100%",
                }}
              >
                {group.urls.map((url, imgIndex) => {
                  const fileIndex = groupIndex * imagesPerGroup + imgIndex;
                  return (
                    <img
                      key={imgIndex}
                      src={url}
                      alt={group.files[imgIndex]?.name || `图片 ${fileIndex + 1}`}
                      className="select-none"
                      style={{
                        width: `${100 / group.urls.length}%`,
                        height: "auto",
                        objectFit: "contain",
                      }}
                      draggable={false}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {/* 悬浮滚动按钮 & 下一文件夹按钮（全屏时隐藏） */}
        {!isFullscreen && (
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-10">
          <button
            onClick={handleScrollUp}
            className="scroll-btn bg-white/80 hover:bg-white border border-gray-300 rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all hover:shadow-xl active:scale-95"
            aria-label="向上滚动"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 15l7-7 7 7"
              />
            </svg>
          </button>
          <button
            onClick={handleScrollDownClick}
            className="scroll-btn bg-white/80 hover:bg-white border border-gray-300 rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all hover:shadow-xl active:scale-95"
            aria-label="向下滚动"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {onLoadNextFolder && (
            <button
              onClick={onLoadNextFolder}
              disabled={isLoading}
              className="scroll-btn bg-white/80 hover:bg-white border border-gray-300 rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="下一文件夹 (D)"
              title="下一文件夹 (D)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-gray-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 12h10"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 7l5 5-5 5"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 6v12"
                />
              </svg>
            </button>
          )}
        </div>
        )}
        {/* 全屏模式：左上角进度、适应屏幕按钮，失去焦点时隐藏退出按钮 */}
        {isFullscreen && onToggleFullscreen && totalFiles > 0 && (
          <div
            className="absolute top-4 left-4 flex flex-col gap-2 z-20"
            onMouseEnter={() => setShowExitFullscreen(true)}
            onMouseLeave={() => setShowExitFullscreen(false)}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-black/60 px-4 py-2 rounded-lg text-white text-sm">
                {scrollPositionRatio !== undefined
                  ? `${currentIndex + 1} / ${totalFiles} · ${Math.round(scrollPositionRatio * 100)}%`
                  : `${currentIndex + 1} / ${totalFiles}`}
              </div>
              {onFullscreenImageFitChange && (
                <button
                  onClick={() =>
                    onFullscreenImageFitChange(
                      fullscreenImageFit === "original" ? "fit" : "original"
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
            {showExitFullscreen && (
              <button
                onClick={onToggleFullscreen}
                onBlur={() => setShowExitFullscreen(false)}
                className="bg-black/60 hover:bg-black/80 px-4 py-2 rounded-lg text-white text-sm flex items-center gap-2 transition-colors"
                title="退出全屏 (ESC)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                退出全屏
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // 分页模式：显示单张图片
  const isFullscreenFit =
    isFullscreen && fullscreenImageFit === "fit";

  return (
    <div className="h-full relative">
      <div
        className={`h-full flex items-center justify-center cursor-grab w-full ${isFullscreenFit ? "p-0" : ""}`}
        onWheel={onWheel}
      >
        <img
          src={imageUrl}
          alt={currentFileName}
          className={`select-none object-contain ${
            isFullscreenFit
              ? "w-full h-full"
              : "max-h-full max-w-full"
          }`}
          style={
            isFullscreenFit
              ? undefined
              : { transform: `scale(${zoom})` }
          }
          draggable={false}
        />
      </div>
      {/* 非全屏时的全屏快捷按钮 */}
      {!isFullscreen && onToggleFullscreen && totalFiles > 0 && (
        <button
          onClick={onToggleFullscreen}
          className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-black/40 hover:bg-black/60 text-white transition-colors"
          title="全屏看图"
          aria-label="全屏"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      )}
      {/* 全屏模式：左上角进度、适应屏幕按钮，失去焦点时隐藏退出按钮 */}
      {isFullscreen && onToggleFullscreen && totalFiles > 0 && (
        <div
          className="absolute top-4 left-4 flex flex-col gap-2 z-20"
          onMouseEnter={() => setShowExitFullscreen(true)}
          onMouseLeave={() => setShowExitFullscreen(false)}
        >
          <div className="flex items-center gap-2">
            <div className="bg-black/60 px-4 py-2 rounded-lg text-white text-sm">
              {currentIndex + 1} / {totalFiles}
            </div>
            {onFullscreenImageFitChange && (
              <button
                onClick={() =>
                  onFullscreenImageFitChange(
                    fullscreenImageFit === "original" ? "fit" : "original"
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
          {showExitFullscreen && (
            <button
              onClick={onToggleFullscreen}
              onBlur={() => setShowExitFullscreen(false)}
              className="bg-black/60 hover:bg-black/80 px-4 py-2 rounded-lg text-white text-sm flex items-center gap-2 transition-colors"
              title="退出全屏 (ESC)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              退出全屏
            </button>
          )}
        </div>
      )}
    </div>
  );
}
