import { useRef, useCallback } from "react";
import { DEFAULT_SCROLL_RATIO } from "../utils/fileUtils";
import type { ViewMode } from "../types";
import { useImageGroups } from "../hooks/useImageGroups";
import { ChevronDownIcon, ChevronUpIcon, FullscreenIcon, NextChapterIcon } from "./Icons";
import { FullscreenOverlay } from "./FullscreenOverlay";
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
  scrollRatio?: number; // 滚动距离比例，默认0.35（约30%视口）
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
  scrollRatio = DEFAULT_SCROLL_RATIO,
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
            <FullscreenIcon className="h-6 w-6" />
          </button>
        )}
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto overflow-x-hidden scroll-mode-container"
          onWheel={isLoading ? undefined : onWheel}
          style={{
            pointerEvents: isLoading ? "none" : "auto",
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          <div className="flex flex-col items-center py-4 space-y-0">
            {imageGroups.map((group, groupIndex) => (
              <div
                key={groupIndex}
                data-image-group={groupIndex}
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
            <ChevronUpIcon size={24} className="text-gray-700" />
          </button>
          <button
            onClick={handleScrollDownClick}
            className="scroll-btn bg-white/80 hover:bg-white border border-gray-300 rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all hover:shadow-xl active:scale-95"
            aria-label="向下滚动"
          >
            <ChevronDownIcon size={24} className="text-gray-700" />
          </button>
          {onLoadNextFolder && (
            <button
              onClick={onLoadNextFolder}
              disabled={isLoading}
              className="scroll-btn bg-white/80 hover:bg-white border border-gray-300 rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="下一文件夹 (D)"
              title="下一文件夹 (D)"
            >
              <NextChapterIcon size={24} className="text-gray-700" />
            </button>
          )}
        </div>
        )}
        {/* 全屏模式：左上角进度、适应屏幕按钮，失去焦点时隐藏退出按钮 */}
        {isFullscreen && onToggleFullscreen && totalFiles > 0 && (
          <FullscreenOverlay
            progressText={
              scrollPositionRatio !== undefined
                ? `${currentIndex + 1} / ${totalFiles} · ${Math.round(scrollPositionRatio * 100)}%`
                : `${currentIndex + 1} / ${totalFiles}`
            }
            fullscreenImageFit={fullscreenImageFit}
            onFullscreenImageFitChange={onFullscreenImageFitChange}
            onToggleFullscreen={onToggleFullscreen}
          />
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
        <FullscreenOverlay
          progressText={`${currentIndex + 1} / ${totalFiles}`}
          fullscreenImageFit={fullscreenImageFit}
          onFullscreenImageFitChange={onFullscreenImageFitChange}
          onToggleFullscreen={onToggleFullscreen}
        />
      )}
    </div>
  );
}
