import { useEffect } from "react";
import type { ViewMode } from "../types";

interface UseCurrentImageDetectionOptions {
  viewMode: ViewMode;
  imageUrls: string[];
  imagesPerGroup: number;
  onCurrentImageChange?: (index: number) => void;
  imageWidth: number;
  zoom: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function useCurrentImageDetection({
  viewMode,
  imageUrls,
  imagesPerGroup,
  onCurrentImageChange,
  imageWidth,
  zoom,
  scrollContainerRef,
}: UseCurrentImageDetectionOptions) {
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

    const imageGroups = container.querySelectorAll("div.flex.w-full");
    if (imageGroups.length === 0) return;

    let scrollTimeout: number;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const containerRect = container.getBoundingClientRect();
        const containerTop = containerRect.top;
        const viewportCenter = containerTop + container.clientHeight / 2;

        let currentGroupIndex = 0;
        let minDistance = Infinity;

        imageGroups.forEach((group, index) => {
          const groupRect = group.getBoundingClientRect();
          const groupCenter = groupRect.top + groupRect.height / 2;
          const distance = Math.abs(groupCenter - viewportCenter);

          // 如果图片组在视口内，或者距离视口中心最近
          if (
            (groupRect.top <= viewportCenter &&
              groupRect.bottom >= viewportCenter) ||
            distance < minDistance
          ) {
            if (distance < minDistance) {
              minDistance = distance;
              currentGroupIndex = index;
            }
          }
        });

        // 将组索引映射回原始图片索引（返回该组第一张图片的索引）
        const originalIndex = currentGroupIndex * imagesPerGroup;
        onCurrentImageChange(originalIndex);
      }, 100); // 防抖100ms
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    // 初始检测一次
    handleScroll();

    return () => {
      clearTimeout(scrollTimeout);
      container.removeEventListener("scroll", handleScroll);
    };
  }, [
    viewMode,
    imageUrls.length,
    onCurrentImageChange,
    imageWidth,
    zoom,
    imagesPerGroup,
    scrollContainerRef,
  ]);
}
