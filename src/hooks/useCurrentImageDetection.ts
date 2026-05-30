import { useEffect, useRef } from "react";
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

/**
 * 用 IntersectionObserver 检测当前可见的图片组。
 * 不再用 getBoundingClientRect + scroll 事件强制回流。
 */
export function useCurrentImageDetection({
  viewMode,
  imageUrls,
  imagesPerGroup,
  onCurrentImageChange,
  scrollContainerRef,
}: UseCurrentImageDetectionOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  // 记录每个元素当前的可见比例
  const visibilityMapRef = useRef<Map<number, number>>(new Map());

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

    // 清理旧 observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    visibilityMapRef.current.clear();

    const groups = container.querySelectorAll("[data-image-group]");
    if (groups.length === 0) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const pickBest = () => {
      let bestIndex = 0;
      let bestRatio = 0;
      visibilityMapRef.current.forEach((ratio, idx) => {
        if (ratio > bestRatio || (ratio === bestRatio && idx < bestIndex)) {
          bestRatio = ratio;
          bestIndex = idx;
        }
      });
      onCurrentImageChange(bestIndex * imagesPerGroup);
    };

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number(
            (entry.target as HTMLElement).dataset.imageGroup ?? "0",
          );
          visibilityMapRef.current.set(idx, entry.intersectionRatio);
        }
        // 防抖避免频繁回调
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(pickBest, 100);
      },
      {
        root: container,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    groups.forEach((el) => observerRef.current?.observe(el));

    // 立即执行一次初始检测
    setTimeout(pickBest, 100);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [
    viewMode,
    imageUrls.length,
    onCurrentImageChange,
    imagesPerGroup,
    scrollContainerRef,
  ]);
}
