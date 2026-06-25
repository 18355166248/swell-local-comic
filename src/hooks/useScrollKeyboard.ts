import { useRef, useEffect, useCallback } from "react";
import type { ViewMode } from "../types";

interface UseScrollKeyboardOptions {
  viewMode: ViewMode;
  scrollRatio: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onLoadNextFolderAtBottom?: () => void;
  isLoading?: boolean;
}

const AT_BOTTOM_THRESHOLD = 5;
const HOLD_DELAY_MS = 450;
const HOLD_INTERVAL_MS = 150;
const TAP_MULTIPLIER = 0.85;
const HOLD_MULTIPLIER = 0.35;

function isAtBottom(container: HTMLElement): boolean {
  return container.scrollHeight - container.scrollTop - container.clientHeight <= AT_BOTTOM_THRESHOLD;
}

export function useScrollKeyboard({
  viewMode,
  scrollRatio,
  scrollContainerRef,
  onLoadNextFolderAtBottom,
  isLoading = false,
}: UseScrollKeyboardOptions) {
  const holdTimerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const dirRef = useRef<1 | -1 | null>(null);
  const isLoadingRef = useRef(isLoading);
  const onLoadNextRef = useRef(onLoadNextFolderAtBottom);
  // ref mirror of scrollRatio so effect doesn't rebuild on slider drag
  const scrollRatioRef = useRef(scrollRatio);

  useEffect(() => {
    isLoadingRef.current = isLoading;
    onLoadNextRef.current = onLoadNextFolderAtBottom;
    scrollRatioRef.current = scrollRatio;
  }, [isLoading, onLoadNextFolderAtBottom, scrollRatio]);

  // 不依赖 scrollRatio/isLoading/onLoadNext，避免 effect 频繁销毁重建
  useEffect(() => {
    if (viewMode !== "scroll") {
      clearAll();
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();
      const code = e.key;
      const isUp = key === "w" || code === "ArrowUp";
      const isDown = key === "s" || code === "ArrowDown";
      if (!isUp && !isDown) return;

      e.preventDefault();
      const dir: 1 | -1 = isUp ? -1 : 1;
      const c = scrollContainerRef.current;
      if (!c) return;

      const ratio = scrollRatioRef.current;

      // 已到底部 → 加载下一文件夹
      if (dir === 1 && onLoadNextRef.current && !isLoadingRef.current && isAtBottom(c)) {
        clearAll();
        onLoadNextRef.current();
        return;
      }

      const tapDist = c.clientHeight * ratio * TAP_MULTIPLIER;
      const holdDist = c.clientHeight * ratio * HOLD_MULTIPLIER;

      if (e.repeat) {
        if (intervalRef.current !== null) return;
        if (dirRef.current !== null && dirRef.current !== dir) clearAll();
        startStepping(dir, holdDist);
        return;
      }

      // 首次按下：即时滚动一步 + 启动长按计时
      clearAll();
      dirRef.current = dir;
      c.scrollBy({ top: tapDist * dir, behavior: "instant" as ScrollBehavior });
      scheduleHold(dir, holdDist);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const c = e.key;
      if (k === "w" || k === "s" || c === "ArrowUp" || c === "ArrowDown") clearAll();
    };

    // -- 内联辅助函数（闭包捕获 ratio，每次 keydown 实时读取） --
    function clearAll() {
      if (holdTimerRef.current !== null) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
      if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null; }
      dirRef.current = null;
    }

    function scheduleHold(dir: 1 | -1, holdDist: number) {
      clearAll();
      dirRef.current = dir;
      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null;
        startStepping(dir, holdDist);
      }, HOLD_DELAY_MS);
    }

    function startStepping(dir: 1 | -1, holdDist: number) {
      clearAll();
      dirRef.current = dir;
      const tick = () => {
        const c2 = scrollContainerRef.current;
        if (!c2 || dirRef.current !== dir) { clearAll(); return; }
        if (dir === 1 && onLoadNextRef.current && !isLoadingRef.current && isAtBottom(c2)) {
          clearAll();
          onLoadNextRef.current();
          return;
        }
        c2.scrollBy({ top: holdDist * dir, behavior: "instant" as ScrollBehavior });
        if (dir === 1 && onLoadNextRef.current && !isLoadingRef.current && isAtBottom(c2)) {
          clearAll();
          onLoadNextRef.current();
        }
      };
      intervalRef.current = window.setInterval(tick, HOLD_INTERVAL_MS);
    }

    const onVisibilityChange = () => {
      if (document.hidden) clearAll();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearAll);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearAll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearAll();
    };
  }, [viewMode, scrollContainerRef]);

  // ---- 屏幕按钮用的 smooth 滚动（保留给 ImageViewer 的按钮点击） ----
  const handleScrollUp = useCallback(() => {
    const c = scrollContainerRef.current;
    if (!c) return;
    c.scrollBy({ top: -(c.clientHeight * scrollRatio * TAP_MULTIPLIER), behavior: "smooth" });
  }, [scrollRatio, scrollContainerRef]);

  const handleScrollDown = useCallback(() => {
    const c = scrollContainerRef.current;
    if (!c) return;
    c.scrollBy({ top: c.clientHeight * scrollRatio * TAP_MULTIPLIER, behavior: "smooth" });
  }, [scrollRatio, scrollContainerRef]);

  return { handleScrollUp, handleScrollDown };
}
