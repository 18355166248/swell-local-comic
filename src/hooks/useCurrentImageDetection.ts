import { useEffect, useRef } from "react";
import type { ViewMode } from "../types";
import { pickReadingGroupIndex } from "../utils/readerPosition";

interface UseCurrentImageDetectionOptions {
  viewMode: ViewMode;
  imageUrls: string[];
  imagesPerGroup: number;
  onCurrentImageChange?: (index: number) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Observe visible groups, then choose the one crossing the viewport's reading line.
 */
export function useCurrentImageDetection({
  viewMode,
  imageUrls,
  imagesPerGroup,
  onCurrentImageChange,
  scrollContainerRef,
}: UseCurrentImageDetectionOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);

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

    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    const groups = container.querySelectorAll("[data-image-group]");
    if (groups.length === 0) return;

    const visibleGroups = new Map<number, HTMLElement>();
    let frame: number | null = null;
    let hasScrolled = false;

    const pickBest = () => {
      frame = null;
      const viewport = container.getBoundingClientRect();
      const candidates = visibleGroups.size ? Array.from(visibleGroups.values()) : Array.from(groups) as HTMLElement[];
      const index = pickReadingGroupIndex(candidates.map((group) => {
        const bounds = group.getBoundingClientRect();
        return { index: Number(group.dataset.imageGroup ?? "0"), top: bounds.top, bottom: bounds.bottom };
      }), {
        top: viewport.top,
        height: container.clientHeight,
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
      });
      if (index !== null) onCurrentImageChange(index * imagesPerGroup);
    };
    const scheduleDetection = () => {
      if (hasScrolled && frame === null) frame = requestAnimationFrame(pickBest);
    };

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number(
            (entry.target as HTMLElement).dataset.imageGroup ?? "0",
          );
          if (entry.isIntersecting) visibleGroups.set(idx, entry.target as HTMLElement);
          else visibleGroups.delete(idx);
        }
        scheduleDetection();
      },
      {
        root: container,
        threshold: 0,
      },
    );

    groups.forEach((el) => observerRef.current?.observe(el));
    const handleScroll = () => {
      hasScrolled = true;
      scheduleDetection();
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("load", scheduleDetection, true);
    const resizeObserver = new ResizeObserver(scheduleDetection);
    resizeObserver.observe(container);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (frame !== null) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("load", scheduleDetection, true);
    };
  }, [
    viewMode,
    imageUrls,
    onCurrentImageChange,
    imagesPerGroup,
    scrollContainerRef,
  ]);
}
