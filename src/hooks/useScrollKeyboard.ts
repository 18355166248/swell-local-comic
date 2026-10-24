import { useRef, useEffect, useCallback } from "react";
import type { ViewMode } from "../types";
import { isKeyOwningWidget } from "../utils/keyboardTarget";

interface UseScrollKeyboardOptions {
  viewMode: ViewMode;
  scrollRatio: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onLoadNextFolderAtBottom?: () => void;
  isLoading?: boolean;
  onScrollIntent?: () => void;
  /** 滚动键生效前调用：把键盘焦点放回阅读画面（清除按钮上的“选中”描边）。 */
  onEngageReader?: () => void;
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
  onScrollIntent,
  onEngageReader,
}: UseScrollKeyboardOptions) {
  const holdTimerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const dirRef = useRef<1 | -1 | null>(null);
  const isLoadingRef = useRef(isLoading);
  const onLoadNextRef = useRef(onLoadNextFolderAtBottom);
  const onScrollIntentRef = useRef(onScrollIntent);
  const onEngageReaderRef = useRef(onEngageReader);
  // ref mirror of scrollRatio so effect doesn't rebuild on slider drag
  const scrollRatioRef = useRef(scrollRatio);

  useEffect(() => {
    isLoadingRef.current = isLoading;
    onLoadNextRef.current = onLoadNextFolderAtBottom;
    scrollRatioRef.current = scrollRatio;
    onScrollIntentRef.current = onScrollIntent;
    onEngageReaderRef.current = onEngageReader;
  }, [isLoading, onLoadNextFolderAtBottom, scrollRatio, onScrollIntent, onEngageReader]);

  // 不依赖 scrollRatio/isLoading/onLoadNext，避免 effect 频繁销毁重建
  useEffect(() => {
    if (viewMode !== "scroll") {
      clearAll();
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      if (document.querySelector("dialog[open]")) return;
      // 按钮/链接不再吞掉 ↑/↓/W/S，否则点过工具按钮后滚动也会失效。
      if (isKeyOwningWidget(e.target)) return;

      const key = e.key.toLowerCase();
      const code = e.key;
      const isUp = key === "w" || code === "ArrowUp";
      const isDown = key === "s" || code === "ArrowDown";
      if (!isUp && !isDown) return;
      if (isLoadingRef.current) return;

      e.preventDefault();
      onEngageReaderRef.current?.();
      const dir: 1 | -1 = isUp ? -1 : 1;
      const c = scrollContainerRef.current;
      if (!c) return;
      onScrollIntentRef.current?.();

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
