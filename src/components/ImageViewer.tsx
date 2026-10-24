import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { Ref } from "react";
import { DEFAULT_SCROLL_RATIO } from "../utils/fileUtils";
import type { ViewMode } from "../types";
import { useImageGroups } from "../hooks/useImageGroups";
import { ChevronDownIcon, ChevronUpIcon, FullscreenIcon, NextChapterIcon } from "./Icons";
import { FullscreenOverlay } from "./FullscreenOverlay";
import { useScrollKeyboard } from "../hooks/useScrollKeyboard";
import { useScrollPosition } from "../hooks/useScrollPosition";
import { useCurrentImageDetection } from "../hooks/useCurrentImageDetection";
import type { ScrollPositionSnapshot } from "../utils/readerPosition";
import type { ReaderImageSize, ReaderImageState } from "../utils/readerImageResources";
import { getPageImageLayout } from "../utils/pageImageLayout";
import type { PageImageFit } from "../utils/pageImageLayout";

export interface ImageViewerHandle {
  flushScrollPosition: () => ScrollPositionSnapshot | null;
  cancelRestoration: () => void;
}

interface ImageViewerProps {
  readerRef?: Ref<ImageViewerHandle>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  imageUrl: string;
  currentFileName?: string;
  zoom: number;
  onWheel: (e: WheelEvent) => void;
  viewMode: ViewMode;
  imageWidth: number;
  imageUrls: string[];
  scrollImageStates?: ReaderImageState[];
  scrollImageSizes?: (ReaderImageSize | null)[];
  isLayoutReady?: boolean;
  isRestoringScrollPosition?: boolean;
  onRestorationEnd?: () => void;
  files: Array<{ name: string; path: string }>;
  scrollRatio?: number; // 滚动距离比例，默认0.35（约30%视口）
  scrollPosition?: number; // 初始滚动位置
  onScrollPositionChange?: (position: number, height: number) => void; // 滚动位置变化回调，包含位置和总高度
  onLoadNextFolder?: () => void; // 滚动到末尾后可通过按钮或快捷键打开下一文件夹
  onCurrentImageChange?: (index: number) => void; // 当前可见图片索引变化回调
  onRetryImage?: (index: number) => void;
  isLoading?: boolean; // 是否正在加载
  isImageLoading?: boolean;
  imagesPerGroup?: number; // 每组图片数量，默认1（每张图片单独显示），可以配置成5（每5张合成一张）
  isFullscreen?: boolean;
  isImmersive?: boolean;
  onToggleFullscreen?: () => void;
  currentIndex?: number;
  totalFiles?: number;
  scrollPositionRatio?: number; // 滚动模式下的滚动进度 0-1
  scrollTargetIndex?: number | null;
  scrollJumpRequest?: number;
  pageImageFit?: PageImageFit;
  fullscreenImageFit?: PageImageFit;
  onFullscreenImageFitChange?: (mode: PageImageFit) => void;
}

export default function ImageViewer({
  readerRef,
  scrollContainerRef,
  imageUrl,
  currentFileName,
  zoom,
  onWheel,
  viewMode,
  imageWidth,
  imageUrls,
  scrollImageStates = [],
  scrollImageSizes = [],
  isLayoutReady = true,
  isRestoringScrollPosition = false,
  onRestorationEnd,
  files,
  scrollRatio = DEFAULT_SCROLL_RATIO,
  scrollPosition,
  onScrollPositionChange,
  onLoadNextFolder,
  onCurrentImageChange,
  onRetryImage,
  isLoading = false,
  isImageLoading = false,
  imagesPerGroup = 1,
  isFullscreen = false,
  isImmersive = true,
  onToggleFullscreen,
  currentIndex = 0,
  totalFiles = 0,
  scrollPositionRatio,
  scrollTargetIndex = null,
  scrollJumpRequest = 0,
  pageImageFit = "height",
  fullscreenImageFit = "height",
  onFullscreenImageFitChange,
}: ImageViewerProps) {
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState({ url: "", width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const markImageFailed = useCallback((url: string) => {
    setFailedUrls((current) => new Set(current).add(url));
  }, []);
  /** 判定「已到底部」的阈值：距离底部小于等于此像素视为到底 */
  const AT_BOTTOM_THRESHOLD = 5;

  useEffect(() => {
    const container = viewMode === "scroll" ? scrollContainerRef.current : pageContainerRef.current;
    if (!container) return;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      if (!isLoading) onWheel(event);
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [viewMode, imageUrl, onWheel, isLoading, isFullscreen, fullscreenImageFit, scrollContainerRef]);

  useLayoutEffect(() => {
    if (viewMode !== "page") return;
    const container = pageContainerRef.current;
    if (!container) return;
    container.scrollTo({
      left: Math.max(0, (container.scrollWidth - container.clientWidth) / 2),
      top: Math.max(0, (container.scrollHeight - container.clientHeight) / 2),
    });
    dragRef.current = null;
  }, [imageUrl, viewMode, pageImageFit, fullscreenImageFit, isFullscreen, zoom, naturalSize, viewportSize]);

  useEffect(() => {
    // 测量不滚动的外层容器：放大后滚动条出现不会反过来压缩基准尺寸，缩放倍率才稳定
    if (viewMode !== "page" || !viewportRef.current) return;
    const container = viewportRef.current;
    const updateSize = () => setViewportSize({ width: container.clientWidth, height: container.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [viewMode, imageUrl]);

  // 使用自定义 hooks
  const imageGroups = useImageGroups(
    imageUrls,
    files,
    imagesPerGroup,
    viewMode
  );

  const { flushScrollPosition, cancelScrollRestoration } = useScrollPosition({
    viewMode,
    restoreKey: files[0]?.path ?? "",
    scrollPosition: scrollTargetIndex === null ? scrollPosition : undefined,
    onScrollPositionChange,
    imageUrls,
    isLoading,
    isLayoutReady,
    onRestorationEnd,
    scrollContainerRef,
  });

  useCurrentImageDetection({
    viewMode,
    imageUrls,
    imagesPerGroup,
    onCurrentImageChange,
    scrollContainerRef,
  });

  const lastJumpRef = useRef<string | null>(null);
  const cancelPendingRestore = useCallback(() => {
    if (scrollTargetIndex !== null) lastJumpRef.current = `${files[0]?.path}:${scrollTargetIndex}:${imagesPerGroup}:${scrollJumpRequest}:done`;
    cancelScrollRestoration();
  }, [cancelScrollRestoration, files, imagesPerGroup, scrollJumpRequest, scrollTargetIndex]);
  const { handleScrollUp, handleScrollDown } = useScrollKeyboard({
    viewMode, scrollRatio, scrollContainerRef,
    onLoadNextFolderAtBottom: onLoadNextFolder,
    isLoading, onScrollIntent: cancelPendingRestore,
  });
  useImperativeHandle(readerRef, () => ({ flushScrollPosition, cancelRestoration: cancelPendingRestore }), [flushScrollPosition, cancelPendingRestore]);
  useEffect(() => {
    if (viewMode !== "scroll" || isLoading) {
      lastJumpRef.current = null;
      return;
    }
    const targetIndex = scrollTargetIndex ?? (!isLayoutReady && isRestoringScrollPosition ? currentIndex : null);
    if (targetIndex === null || imageUrls.length !== files.length) return;
    if (!isLayoutReady && !imageUrls[targetIndex] && scrollImageStates[targetIndex] !== "error") return;
    const key = `${files[0]?.path}:${targetIndex}:${imagesPerGroup}:${scrollJumpRequest}`;
    const phase = isLayoutReady ? "done" : "preview";
    if (lastJumpRef.current === `${key}:done` || lastJumpRef.current === `${key}:${phase}`) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const groupIndex = Math.floor(targetIndex / imagesPerGroup);
    const jump = () => {
      const group = container.querySelector<HTMLElement>(`[data-image-group="${groupIndex}"]`);
      if (!group) return;
      container.scrollTop += group.getBoundingClientRect().top - container.getBoundingClientRect().top;
      lastJumpRef.current = `${key}:${phase}`;
      if (isLayoutReady) onRestorationEnd?.();
    };
    const frame = requestAnimationFrame(jump);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [viewMode, scrollTargetIndex, scrollJumpRequest, isLoading, isLayoutReady, imageUrls, scrollImageStates, isRestoringScrollPosition, currentIndex, files, imagesPerGroup, scrollContainerRef, onRestorationEnd]);

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
  }, [handleScrollDown, onLoadNextFolder, isLoading, scrollContainerRef]);

  if (viewMode === "page" && isImageLoading && !imageUrl) {
    return <div role="status" className="flex h-full items-center justify-center text-sm text-gray-400">正在加载第 {currentIndex + 1} 页…</div>;
  }

  if ((!imageUrl || failedUrls.has(imageUrl)) && imageUrls.length === 0 && files.length > 0 && !isLoading && !isImageLoading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-200">
        <button type="button" onClick={() => onRetryImage?.(currentIndex)} className="rounded-xl border border-white/10 bg-gray-800 px-6 py-4 hover:bg-gray-700">
          当前图片加载失败，点击重试
        </button>
      </div>
    );
  }

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
          role="region"
          aria-label="滚动阅读区域"
          tabIndex={0}
          onWheelCapture={cancelPendingRestore}
          onPointerDown={cancelPendingRestore}
          onKeyDownCapture={(event) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "w", "s"].includes(event.key)) cancelPendingRestore(); }}
          className="h-full overflow-y-auto overflow-x-hidden scroll-mode-container"
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
                  width: isFullscreen && fullscreenImageFit !== "original"
                    ? "100%"
                    : `${imageWidth * zoom}px`,
                  maxWidth: "100%",
                }}
              >
                {group.urls.map((url, imgIndex) => {
                  const fileIndex = groupIndex * imagesPerGroup + imgIndex;
                  const size = scrollImageSizes[fileIndex];
                  const failed = scrollImageStates[fileIndex] === "error" || failedUrls.has(url);
                  if (!url && !failed) return <div key={imgIndex} role="status" className="flex items-center justify-center bg-[#111a24] text-xs text-slate-500" style={{ width: `${100 / group.urls.length}%`, aspectRatio: size ? `${size.width} / ${size.height}` : "2 / 3" }}>正在加载第 {fileIndex + 1} 页…</div>;
                  if (failed) {
                    return (
                      <button
                        key={imgIndex}
                        type="button"
                        onClick={() => onRetryImage?.(fileIndex)}
                        className="flex min-h-[50vh] items-center justify-center bg-gray-800 px-4 text-sm text-gray-200 hover:bg-gray-700"
                        style={{ width: `${100 / group.urls.length}%`, aspectRatio: size ? `${size.width} / ${size.height}` : "2 / 3" }}
                      >
                        {group.files[imgIndex]?.name || `第 ${fileIndex + 1} 页`} 加载失败，点击重试
                      </button>
                    );
                  }
                  return (
                    <img
                      key={imgIndex}
                      src={url}
                      alt={group.files[imgIndex]?.name || `图片 ${fileIndex + 1}`}
                      className="select-none"
                      decoding="async"
                      width={size?.width}
                      height={size?.height}
                      onError={() => markImageFailed(url)}
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
            onClick={() => { cancelPendingRestore(); handleScrollUp(); }}
            className="scroll-btn bg-[#152130]/90 hover:bg-[#243750] border border-white/15 rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-colors"
            aria-label="向上滚动"
          >
            <ChevronUpIcon size={20} className="text-slate-200" />
          </button>
          <button
            onClick={() => { cancelPendingRestore(); handleScrollDownClick(); }}
            className="scroll-btn bg-[#152130]/90 hover:bg-[#243750] border border-white/15 rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-colors"
            aria-label="向下滚动"
          >
            <ChevronDownIcon size={20} className="text-slate-200" />
          </button>
          {onLoadNextFolder && (
            <button
              onClick={onLoadNextFolder}
              disabled={isLoading}
              className="scroll-btn bg-[#152130]/90 hover:bg-[#243750] border border-white/15 rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="下一文件夹 (D)"
              title="下一文件夹 (D)"
            >
              <NextChapterIcon size={20} className="text-slate-200" />
            </button>
          )}
        </div>
        )}
        {/* 全屏模式：进度、适配方式和可键盘访问的退出按钮 */}
        {isFullscreen && onToggleFullscreen && totalFiles > 0 && (
          <FullscreenOverlay
            immersive={isImmersive}
            progressText={
              scrollPositionRatio !== undefined
                ? `${currentIndex + 1} / ${totalFiles} · ${Math.round(scrollPositionRatio * 100)}%`
                : `${currentIndex + 1} / ${totalFiles}`
            }
            fit={fullscreenImageFit === "height" ? "contain" : fullscreenImageFit}
            onFitChange={onFullscreenImageFitChange}
            onToggleFullscreen={onToggleFullscreen}
            scrollMode
          />
        )}
      </div>
    );
  }

  // 分页模式：显示单张图片
  const currentNaturalSize = naturalSize.url === imageUrl ? naturalSize : null;
  const { width: displayWidth, height: displayHeight } = getPageImageLayout(
    currentNaturalSize,
    viewportSize,
    isFullscreen ? fullscreenImageFit : pageImageFit,
    zoom,
  );
  const canPanPage = displayWidth > viewportSize.width || displayHeight > viewportSize.height;

  return (
    <div ref={viewportRef} className="h-full relative">
      <div
        ref={pageContainerRef}
        role="region"
        aria-label="分页阅读区域"
        tabIndex={0}
        className={`page-image-viewport h-full w-full overflow-auto ${canPanPage ? "cursor-grab active:cursor-grabbing" : ""}`}
        onPointerDown={(event) => {
          const container = pageContainerRef.current;
          if (!container || !canPanPage || event.button !== 0) return;
          dragRef.current = { x: event.clientX, y: event.clientY, left: container.scrollLeft, top: container.scrollTop };
          container.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const container = pageContainerRef.current;
          if (!container || !dragRef.current) return;
          container.scrollLeft = dragRef.current.left - (event.clientX - dragRef.current.x);
          container.scrollTop = dragRef.current.top - (event.clientY - dragRef.current.y);
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        <div className="flex min-h-full min-w-full items-center justify-center" style={{ width: displayWidth || undefined, height: displayHeight || undefined }}>
          <img
            key={imageUrl}
            src={imageUrl}
            alt={currentFileName}
            className="select-none object-contain"
            style={{ width: displayWidth || undefined, height: displayHeight || undefined, maxWidth: currentNaturalSize ? "none" : "100%", maxHeight: currentNaturalSize ? "none" : "100%" }}
            onLoad={(event) => setNaturalSize({ url: imageUrl, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            onError={() => markImageFailed(imageUrl)}
            draggable={false}
            decoding="async"
          />
        </div>
      </div>
      {/* 全屏模式：进度、适配方式和可键盘访问的退出按钮 */}
      {isFullscreen && onToggleFullscreen && totalFiles > 0 && (
        <FullscreenOverlay
          immersive={isImmersive}
          progressText={`${currentIndex + 1} / ${totalFiles}`}
          fit={fullscreenImageFit}
          onFitChange={onFullscreenImageFitChange}
          onToggleFullscreen={onToggleFullscreen}
        />
      )}
    </div>
  );
}
