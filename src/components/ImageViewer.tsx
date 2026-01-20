import { useRef } from "react";
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
  onCurrentImageChange?: (index: number) => void; // 当前可见图片索引变化回调
  isLoading?: boolean; // 是否正在加载
  imagesPerGroup?: number; // 每组图片数量，默认1（每张图片单独显示），可以配置成5（每5张合成一张）
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
  onCurrentImageChange,
  isLoading = false,
  imagesPerGroup = 1,
}: ImageViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
                  width: `${imageWidth * zoom}px`,
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
        {/* 悬浮滚动按钮 */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-10">
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
            onClick={handleScrollDown}
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
        </div>
      </div>
    );
  }

  // 分页模式：显示单张图片
  return (
    <div
      className="h-full flex items-center justify-center cursor-grab"
      onWheel={onWheel}
    >
      <img
        src={imageUrl}
        alt={currentFileName}
        className="max-h-full max-w-full object-contain select-none"
        style={{ transform: `scale(${zoom})` }}
        draggable={false}
      />
    </div>
  );
}
