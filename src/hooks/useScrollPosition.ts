import { useEffect, useRef } from "react";
import type { ViewMode } from "../types";

interface UseScrollPositionOptions {
  viewMode: ViewMode;
  restoreKey: string;
  scrollPosition?: number;
  onScrollPositionChange?: (position: number, height: number) => void;
  imageUrls: string[];
  isLoading: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function useScrollPosition({
  viewMode,
  restoreKey,
  scrollPosition,
  onScrollPositionChange,
  imageUrls,
  isLoading,
  scrollContainerRef,
}: UseScrollPositionOptions) {
  const restoredKeyRef = useRef<string | null>(null);
  const shouldRestore = scrollPosition !== undefined;
  const initialPositionRef = useRef<{ key: string; position: number } | null>(null);
  if (initialPositionRef.current?.key !== restoreKey && scrollPosition !== undefined) {
    initialPositionRef.current = { key: restoreKey, position: scrollPosition };
  }

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || viewMode !== "scroll" || !onScrollPositionChange) return;
    let timer: number | undefined;
    const handleScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!isLoading) onScrollPositionChange(container.scrollTop, Math.max(0, container.scrollHeight - container.clientHeight));
      }, 300);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.clearTimeout(timer);
    };
  }, [viewMode, onScrollPositionChange, isLoading, scrollContainerRef]);

  useEffect(() => {
    if (viewMode !== "scroll") {
      restoredKeyRef.current = null;
      return;
    }
    const container = scrollContainerRef.current;
    const initialPosition = initialPositionRef.current;
    if (!container || !shouldRestore || !initialPosition || initialPosition.key !== restoreKey || imageUrls.length === 0 || isLoading || restoredKeyRef.current === restoreKey) return;

    restoredKeyRef.current = restoreKey;
    const target = Math.max(0, initialPosition.position);
    let timer: number | undefined;
    let attempts = 0;
    const restore = () => {
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      container.scrollTop = Math.min(target, maxScroll);
      if (maxScroll < target && attempts++ < 20) timer = window.setTimeout(restore, 100);
    };
    timer = window.setTimeout(restore, 100);
    return () => window.clearTimeout(timer);
  }, [viewMode, restoreKey, shouldRestore, imageUrls.length, isLoading, scrollContainerRef]);
}
