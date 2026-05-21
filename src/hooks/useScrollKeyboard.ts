import { useRef, useEffect, useCallback } from "react";
import type { ViewMode } from "../types";

interface UseScrollKeyboardOptions {
  viewMode: ViewMode;
  scrollRatio: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** 已在底部时按 S/ArrowDown 触发加载下一文件夹 */
  onLoadNextFolderAtBottom?: () => void;
  isLoading?: boolean;
}

const AT_BOTTOM_THRESHOLD = 5;
const BASE_SCROLL_PIXELS_PER_SECOND = 900;
const MIN_SCROLL_PIXELS_PER_SECOND = 480;
/** 按住超过该时间后启动连续滚动；短按仅步进滚动 */
const HOLD_SCROLL_DELAY_MS = 150;
/** 单次按键/点击的滚动距离倍率（相对 scrollRatio） */
const TAP_SCROLL_MULTIPLIER = 1.25;

function isAtBottom(container: HTMLElement): boolean {
  const { scrollTop, scrollHeight, clientHeight } = container;
  const distanceToBottom = scrollHeight - scrollTop - clientHeight;
  return distanceToBottom <= AT_BOTTOM_THRESHOLD;
}

function getContinuousScrollSpeed(containerHeight: number, scrollRatio: number) {
  return Math.max(
    MIN_SCROLL_PIXELS_PER_SECOND,
    containerHeight * scrollRatio * 2,
    BASE_SCROLL_PIXELS_PER_SECOND * scrollRatio,
  );
}

export function useScrollKeyboard({
  viewMode,
  scrollRatio,
  scrollContainerRef,
  onLoadNextFolderAtBottom,
  isLoading = false,
}: UseScrollKeyboardOptions) {
  const animationFrameRef = useRef<number | null>(null);
  const holdDelayTimerRef = useRef<number | null>(null);
  const pressedKeyRef = useRef<string | null>(null);
  const scrollDirectionRef = useRef<1 | -1 | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);

  const getTapScrollDistance = useCallback(
    (container: HTMLElement) =>
      container.clientHeight * scrollRatio * TAP_SCROLL_MULTIPLIER,
    [scrollRatio],
  );

  const handleScrollUp = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollBy({
      top: -getTapScrollDistance(container),
      behavior: "smooth",
    });
  }, [getTapScrollDistance, scrollContainerRef]);

  const handleScrollDown = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollBy({
      top: getTapScrollDistance(container),
      behavior: "smooth",
    });
  }, [getTapScrollDistance, scrollContainerRef]);

  const clearHoldDelay = useCallback(() => {
    if (holdDelayTimerRef.current !== null) {
      clearTimeout(holdDelayTimerRef.current);
      holdDelayTimerRef.current = null;
    }
  }, []);

  const stopScrolling = useCallback(() => {
    clearHoldDelay();
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    pressedKeyRef.current = null;
    scrollDirectionRef.current = null;
    lastFrameTimeRef.current = null;
  }, [clearHoldDelay]);

  const startContinuousScroll = useCallback(
    (keyId: string, direction: 1 | -1) => {
      if (scrollContainerRef.current === null) {
        return;
      }

      stopScrolling();
      pressedKeyRef.current = keyId;
      scrollDirectionRef.current = direction;

      const tick = (timestamp: number) => {
        const container = scrollContainerRef.current;
        const currentDirection = scrollDirectionRef.current;

        if (!container || currentDirection === null) {
          stopScrolling();
          return;
        }

        if (currentDirection === 1) {
          if (
            onLoadNextFolderAtBottom &&
            !isLoading &&
            isAtBottom(container)
          ) {
            stopScrolling();
            onLoadNextFolderAtBottom();
            return;
          }
        }

        if (lastFrameTimeRef.current === null) {
          lastFrameTimeRef.current = timestamp;
        }

        const deltaTime = Math.min(
          timestamp - lastFrameTimeRef.current,
          32,
        );
        lastFrameTimeRef.current = timestamp;

        const speed = getContinuousScrollSpeed(
          container.clientHeight,
          scrollRatio,
        );
        const distance = (speed * deltaTime) / 1000;

        if (distance > 0) {
          container.scrollTop += distance * currentDirection;
        }

        if (
          currentDirection === 1 &&
          onLoadNextFolderAtBottom &&
          !isLoading &&
          isAtBottom(container)
        ) {
          stopScrolling();
          onLoadNextFolderAtBottom();
          return;
        }

        animationFrameRef.current = requestAnimationFrame(tick);
      };

      animationFrameRef.current = requestAnimationFrame(tick);
    },
    [
      isLoading,
      onLoadNextFolderAtBottom,
      scrollContainerRef,
      scrollRatio,
      stopScrolling,
    ],
  );

  const scheduleContinuousScroll = useCallback(
    (keyId: string, direction: 1 | -1) => {
      clearHoldDelay();
      holdDelayTimerRef.current = window.setTimeout(() => {
        holdDelayTimerRef.current = null;
        startContinuousScroll(keyId, direction);
      }, HOLD_SCROLL_DELAY_MS);
    },
    [clearHoldDelay, startContinuousScroll],
  );

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
      const keyCode = e.key;

      // w 键或上箭头键向上滚动
      if (key === "w" || keyCode === "ArrowUp") {
        e.preventDefault();
        const keyId = keyCode === "ArrowUp" ? "ArrowUp" : "w";
        if (e.repeat) {
          if (animationFrameRef.current !== null && pressedKeyRef.current === keyId) {
            return;
          }
          scheduleContinuousScroll(keyId, -1);
          return;
        }

        stopScrolling();
        pressedKeyRef.current = keyId;
        handleScrollUp();
        scheduleContinuousScroll(keyId, -1);
      }
      // s 键或下箭头键向下滚动（已在底部时加载下一文件夹）
      else if (key === "s" || keyCode === "ArrowDown") {
        e.preventDefault();
        const keyId = keyCode === "ArrowDown" ? "ArrowDown" : "s";
        const container = scrollContainerRef.current;

        if (
          container &&
          onLoadNextFolderAtBottom &&
          !isLoading &&
          isAtBottom(container)
        ) {
          stopScrolling();
          onLoadNextFolderAtBottom();
          return;
        }

        if (e.repeat) {
          if (animationFrameRef.current !== null && pressedKeyRef.current === keyId) {
            return;
          }
          scheduleContinuousScroll(keyId, 1);
          return;
        }

        stopScrolling();
        pressedKeyRef.current = keyId;
        handleScrollDown();
        scheduleContinuousScroll(keyId, 1);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const keyCode = e.key;
      // 松开 w、s、上箭头或下箭头键时停止滚动
      if (
        (key === "w" ||
          key === "s" ||
          keyCode === "ArrowUp" ||
          keyCode === "ArrowDown") &&
        (pressedKeyRef.current === key || pressedKeyRef.current === keyCode)
      ) {
        stopScrolling();
      }
    };

    // 当窗口失去焦点时也停止滚动
    const handleBlur = () => {
      stopScrolling();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopScrolling();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopScrolling();
    };
  }, [
    viewMode,
    handleScrollUp,
    handleScrollDown,
    scheduleContinuousScroll,
    stopScrolling,
    onLoadNextFolderAtBottom,
    isLoading,
    scrollContainerRef,
  ]);

  return {
    handleScrollUp,
    handleScrollDown,
  };
}
