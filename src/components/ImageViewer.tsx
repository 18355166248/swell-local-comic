import { useRef, useEffect } from "react";
import type { ViewMode } from "../types";

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
  scrollRatio = 0.8,
  scrollPosition,
  onScrollPositionChange,
  onCurrentImageChange,
  isLoading = false,
}: ImageViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<number | null>(null);
  const pressedKeyRef = useRef<string | null>(null);

  // 监听滚动位置变化
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || viewMode !== "scroll" || !onScrollPositionChange) return;

    let scrollTimeout: number;

    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        onScrollPositionChange(container.scrollTop, container.scrollHeight);
      }, 300); // 防抖300ms
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      clearTimeout(scrollTimeout);
      container.removeEventListener("scroll", handleScroll);
    };
  }, [viewMode, onScrollPositionChange]);

  // 设置初始滚动位置
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && viewMode === "scroll" && scrollPosition !== undefined) {
      // 临时禁用平滑滚动，设置初始位置
      const originalScrollBehavior = container.style.scrollBehavior;
      container.style.scrollBehavior = "auto";

      // 延迟设置，确保内容已渲染
      setTimeout(() => {
        container.scrollTop = scrollPosition;
        // 恢复平滑滚动
        setTimeout(() => {
          container.style.scrollBehavior = originalScrollBehavior;
        }, 100);
      }, 100);
    }
  }, [viewMode, scrollPosition, imageUrls.length]);

  // 滚动处理函数
  const handleScrollUp = () => {
    if (scrollContainerRef.current) {
      const containerHeight = scrollContainerRef.current.clientHeight;
      const scrollDistance = containerHeight * scrollRatio;
      scrollContainerRef.current.scrollBy({
        top: -scrollDistance,
        behavior: "smooth",
      });
    }
  };

  const handleScrollDown = () => {
    if (scrollContainerRef.current) {
      const containerHeight = scrollContainerRef.current.clientHeight;
      const scrollDistance = containerHeight * scrollRatio;
      scrollContainerRef.current.scrollBy({
        top: scrollDistance,
        behavior: "smooth",
      });
    }
  };

  // 停止滚动
  const stopScrolling = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
      pressedKeyRef.current = null;
    }
  };

  // 键盘快捷键：只在滚动模式下生效
  useEffect(() => {
    if (viewMode !== "scroll") {
      stopScrolling();
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果用户在输入框中输入，不触发快捷键
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // w 键向上滚动
      if (key === "w") {
        e.preventDefault();
        // 如果已经有定时器在运行，不重复创建
        if (scrollIntervalRef.current && pressedKeyRef.current === "w") {
          return;
        }
        // 清除之前的定时器（如果有）
        stopScrolling();
        // 立即执行一次
        handleScrollUp();
        // 设置持续滚动
        pressedKeyRef.current = "w";
        scrollIntervalRef.current = setInterval(() => {
          handleScrollUp();
        }, 100); // 每100ms滚动一次
      }
      // s 键向下滚动
      else if (key === "s") {
        e.preventDefault();
        // 如果已经有定时器在运行，不重复创建
        if (scrollIntervalRef.current && pressedKeyRef.current === "s") {
          return;
        }
        // 清除之前的定时器（如果有）
        stopScrolling();
        // 立即执行一次
        handleScrollDown();
        // 设置持续滚动
        pressedKeyRef.current = "s";
        scrollIntervalRef.current = setInterval(() => {
          handleScrollDown();
        }, 100); // 每100ms滚动一次
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // 松开 w 或 s 键时停止滚动
      if ((key === "w" || key === "s") && pressedKeyRef.current === key) {
        stopScrolling();
      }
    };

    // 当窗口失去焦点时也停止滚动
    const handleBlur = () => {
      stopScrolling();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      stopScrolling();
    };
  }, [viewMode, scrollRatio]);

  // 检测当前可见的图片索引（滚动模式）
  useEffect(() => {
    if (
      viewMode !== "scroll" ||
      !onCurrentImageChange ||
      imageUrls.length === 0
    ) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    const images = container.querySelectorAll("img");
    if (images.length === 0) return;

    let scrollTimeout: number;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const containerRect = container.getBoundingClientRect();
        const containerTop = containerRect.top;
        const viewportCenter = containerTop + container.clientHeight / 2;

        let currentIndex = 0;
        let minDistance = Infinity;

        images.forEach((img, index) => {
          const imgRect = img.getBoundingClientRect();
          const imgCenter = imgRect.top + imgRect.height / 2;
          const distance = Math.abs(imgCenter - viewportCenter);

          // 如果图片在视口内，或者距离视口中心最近
          if (
            (imgRect.top <= viewportCenter &&
              imgRect.bottom >= viewportCenter) ||
            distance < minDistance
          ) {
            if (distance < minDistance) {
              minDistance = distance;
              currentIndex = index;
            }
          }
        });

        onCurrentImageChange(currentIndex);
      }, 100); // 防抖100ms
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    // 初始检测一次
    handleScroll();

    return () => {
      clearTimeout(scrollTimeout);
      container.removeEventListener("scroll", handleScroll);
    };
  }, [viewMode, imageUrls.length, onCurrentImageChange, imageWidth, zoom]);

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
            {imageUrls.map((url, index) => (
              <img
                key={index}
                src={url}
                alt={files[index]?.name || `图片 ${index + 1}`}
                className="select-none"
                style={{
                  width: `${imageWidth * zoom}px`,
                  maxWidth: "100%",
                  height: "auto",
                  objectFit: "contain",
                }}
                draggable={false}
              />
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
