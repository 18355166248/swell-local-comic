import { useRef, useEffect } from "react";
import type { ViewMode } from "../types";

interface UseScrollPositionOptions {
  viewMode: ViewMode;
  scrollPosition?: number;
  onScrollPositionChange?: (position: number, height: number) => void;
  imageUrls: string[];
  isLoading: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function useScrollPosition({
  viewMode,
  scrollPosition,
  onScrollPositionChange,
  imageUrls,
  isLoading,
  scrollContainerRef,
}: UseScrollPositionOptions) {
  const hasRestoredPositionRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // 监听滚动位置变化（用户滚动时保存位置）
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || viewMode !== "scroll" || !onScrollPositionChange) return;

    const handleScroll = () => {
      // 清除之前的定时器
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // 防抖：延迟更新位置，减少更新频率
      scrollTimeoutRef.current = setTimeout(() => {
        if (container && !isLoading) {
          onScrollPositionChange(container.scrollTop, container.scrollHeight);
        }
      }, 300); // 增加防抖时间到300ms，减少更新频率
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [viewMode, onScrollPositionChange, isLoading, scrollContainerRef]);

  // 只在首次加载完成时恢复滚动位置（简化逻辑）
  useEffect(() => {
    const container = scrollContainerRef.current;

    // 条件检查：只在滚动模式、有位置信息、内容已加载、未恢复过时执行
    if (
      !container ||
      viewMode !== "scroll" ||
      scrollPosition === undefined ||
      scrollPosition < 0 ||
      imageUrls.length === 0 ||
      isLoading ||
      hasRestoredPositionRef.current
    ) {
      return;
    }

    // 标记已恢复，避免重复恢复
    hasRestoredPositionRef.current = true;

    // 等待内容渲染完成后恢复位置
    const restorePosition = () => {
      if (!container) return;

      const currentHeight = container.scrollHeight;
      const targetPosition = scrollPosition;

      // 如果内容高度足够，直接恢复
      if (currentHeight >= targetPosition + 50) {
        container.style.scrollBehavior = "auto";
        container.scrollTop = targetPosition;
        // 恢复平滑滚动
        setTimeout(() => {
          if (container) {
            container.style.scrollBehavior = "smooth";
          }
        }, 100);
      } else {
        // 内容高度不足，等待一下再试（最多等待1秒）
        setTimeout(() => {
          if (container && container.scrollHeight >= targetPosition + 50) {
            container.style.scrollBehavior = "auto";
            container.scrollTop = targetPosition;
            setTimeout(() => {
              if (container) {
                container.style.scrollBehavior = "smooth";
              }
            }, 100);
          }
        }, 500);
      }
    };

    // 延迟执行，确保内容已渲染
    const timeoutId = setTimeout(restorePosition, 200);
    return () => clearTimeout(timeoutId);
  }, [viewMode, scrollPosition, imageUrls.length, isLoading, scrollContainerRef]);

  // 当切换模式或重新加载时，重置恢复标记
  useEffect(() => {
    if (viewMode === "scroll" && imageUrls.length > 0 && !isLoading) {
      // 延迟重置，确保恢复逻辑已执行
      const timeoutId = setTimeout(() => {
        hasRestoredPositionRef.current = false;
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [viewMode, imageUrls.length, isLoading]);
}
