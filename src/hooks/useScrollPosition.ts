import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ViewMode } from "../types";
import { createScrollPositionReporter, createScrollRestorationScheduler, getScrollPositionSnapshot, type ScrollPositionSnapshot } from "../utils/readerPosition";

interface UseScrollPositionOptions {
  viewMode: ViewMode;
  restoreKey: string;
  scrollPosition?: number;
  onScrollPositionChange?: (position: number, height: number) => void;
  imageUrls: string[];
  isLoading: boolean;
  isLayoutReady?: boolean;
  onRestorationEnd?: () => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function useScrollPosition({
  viewMode,
  restoreKey,
  scrollPosition,
  onScrollPositionChange,
  imageUrls,
  isLoading,
  isLayoutReady = true,
  onRestorationEnd,
  scrollContainerRef,
}: UseScrollPositionOptions) {
  const flushRef = useRef<() => ScrollPositionSnapshot | null>(() => null);
  const flushScrollPosition = useCallback(() => flushRef.current(), []);
  const restorationScheduler = useMemo(() => createScrollRestorationScheduler(), []);
  const cancelScrollRestoration = useCallback(() => {
    restorationScheduler.cancel(restoreKey);
    onRestorationEnd?.();
  }, [restoreKey, onRestorationEnd, restorationScheduler]);
  const shouldRestore = scrollPosition !== undefined;
  const initialPositionRef = useRef<{ key: string; position: number } | null>(null);
  useEffect(() => {
    if (!isLoading && initialPositionRef.current?.key !== restoreKey && scrollPosition !== undefined) {
      initialPositionRef.current = { key: restoreKey, position: scrollPosition };
    }
  }, [isLoading, restoreKey, scrollPosition]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || viewMode !== "scroll" || !onScrollPositionChange || isLoading) return;
    let timer: number | undefined;
    const reporter = createScrollPositionReporter(({ position, height }) => onScrollPositionChange(position, height));
    const flushPending = () => {
      window.clearTimeout(timer);
      return reporter.flush();
    };
    const captureAndFlush = () => {
      reporter.capture(getScrollPositionSnapshot(container));
      return flushPending();
    };
    flushRef.current = captureAndFlush;
    const handleScroll = () => {
      reporter.capture(getScrollPositionSnapshot(container));
      window.clearTimeout(timer);
      timer = window.setTimeout(flushPending, 300);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushPending();
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", flushPending);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", flushPending);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Use the captured event values: the DOM may already show another chapter.
      flushPending();
      if (flushRef.current === captureAndFlush) flushRef.current = () => null;
    };
  }, [viewMode, onScrollPositionChange, isLoading, scrollContainerRef]);

  useEffect(() => {
    if (viewMode !== "scroll") {
      restorationScheduler.reset();
      return;
    }
    if (isLoading) {
      // A new open can target the same folder. Capture its position only after
      // the new chapter state commits, rather than reusing the previous visit.
      restorationScheduler.reset();
      initialPositionRef.current = null;
      return;
    }
    const container = scrollContainerRef.current;
    const initialPosition = initialPositionRef.current;
    if (!container || !shouldRestore || !initialPosition || initialPosition.key !== restoreKey || imageUrls.length === 0 || !isLayoutReady) return;

    const target = Math.max(0, initialPosition.position);
    return restorationScheduler.schedule(restoreKey, () => {
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      container.scrollTop = Math.min(target, maxScroll);
      return maxScroll >= target;
    }, onRestorationEnd);
  }, [viewMode, restoreKey, shouldRestore, imageUrls.length, isLoading, isLayoutReady, scrollContainerRef, onRestorationEnd, restorationScheduler]);

  return { flushScrollPosition, cancelScrollRestoration };
}
