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
/** 按住超过该时间后启动连续步进 */
const HOLD_DELAY_MS = 450;
/** 长按步进间隔 */
const HOLD_INTERVAL_MS = 150;
/** 单击滚动倍率 */
const TAP_MULTIPLIER = 0.85;
/** 长按步长倍率（比单击更小，避免跳跃过大） */
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

  const getTapDist = useCallback(
    (container: HTMLElement) => container.clientHeight * scrollRatio * TAP_MULTIPLIER,
    [scrollRatio],
  );

  const getHoldDist = useCallback(
    (container: HTMLElement) => container.clientHeight * scrollRatio * HOLD_MULTIPLIER,
    [scrollRatio],
  );

  /** 执行一次即时滚动（无 smooth，避免和后续步进冲突） */
  const doInstantScroll = useCallback(
    (dist: number, dir: 1 | -1) => {
      const c = scrollContainerRef.current;
      if (!c || dir !== dirRef.current) return;

      if (dir === 1 && onLoadNextFolderAtBottom && !isLoading && isAtBottom(c)) {
        stopAll();
        onLoadNextFolderAtBottom();
        return;
      }

      c.scrollBy({ top: dist * dir, behavior: "instant" as ScrollBehavior });

      if (dir === 1 && onLoadNextFolderAtBottom && !isLoading && isAtBottom(c)) {
        stopAll();
        onLoadNextFolderAtBottom();
      }
    },
    [scrollContainerRef, onLoadNextFolderAtBottom, isLoading],
  );

  const clearAll = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopAll = useCallback(() => {
    clearAll();
    dirRef.current = null;
  }, [clearAll]);

  /** 启动长按连续步进 */
  const startStepping = useCallback(
    (dir: 1 | -1) => {
      clearAll();
      dirRef.current = dir;

      const tick = () => {
        const c = scrollContainerRef.current;
        const d = dirRef.current;
        if (!c || d === null || d !== dir) {
          stopAll();
          return;
        }
        doInstantScroll(getHoldDist(c), d);
      };

      intervalRef.current = window.setInterval(tick, HOLD_INTERVAL_MS);
    },
    [clearAll, doInstantScroll, getHoldDist, scrollContainerRef, stopAll],
  );

  const scheduleHold = useCallback(
    (dir: 1 | -1) => {
      clearAll();
      dirRef.current = dir;
      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null;
        startStepping(dir);
      }, HOLD_DELAY_MS);
    },
    [clearAll, startStepping],
  );

  // ---- 键盘事件 ----
  useEffect(() => {
    if (viewMode !== "scroll") {
      stopAll();
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

      // 已到底部 → 加载下一文件夹
      if (dir === 1) {
        const c = scrollContainerRef.current;
        if (c && onLoadNextFolderAtBottom && !isLoading && isAtBottom(c)) {
          stopAll();
          onLoadNextFolderAtBottom();
          return;
        }
      }

      if (e.repeat) {
        // repeat 事件：如果已经在步进则不重复启动
        if (intervalRef.current !== null) return;
        // 已经按了别的键且不是当前方向
        if (dirRef.current !== null && dirRef.current !== dir) stopAll();
        startStepping(dir);
        return;
      }

      // 首次按下：先执行一次即时滚动，然后启动长按计时
      stopAll();
      dirRef.current = dir;
      const c = scrollContainerRef.current;
      if (c) {
        doInstantScroll(getTapDist(c), dir);
      }
      scheduleHold(dir);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.key;
      if (
        key === "w" || key === "s" || code === "ArrowUp" || code === "ArrowDown"
      ) {
        stopAll();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", stopAll);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAll();
    });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", stopAll);
      document.removeEventListener("visibilitychange", stopAll as EventListener);
      stopAll();
    };
  }, [
    viewMode,
    doInstantScroll,
    getTapDist,
    scheduleHold,
    startStepping,
    stopAll,
    onLoadNextFolderAtBottom,
    isLoading,
    scrollContainerRef,
  ]);

  // ---- 屏幕按钮用的 smooth 滚动（保留给 ImageViewer 的按钮点击） ----
  const handleScrollUp = useCallback(() => {
    const c = scrollContainerRef.current;
    if (!c) return;
    c.scrollBy({ top: -getTapDist(c), behavior: "smooth" });
  }, [getTapDist, scrollContainerRef]);

  const handleScrollDown = useCallback(() => {
    const c = scrollContainerRef.current;
    if (!c) return;
    c.scrollBy({ top: getTapDist(c), behavior: "smooth" });
  }, [getTapDist, scrollContainerRef]);

  return { handleScrollUp, handleScrollDown };
}
