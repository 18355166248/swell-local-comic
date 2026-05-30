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
/** 按住超过该时间后启动步进滚动；短按仅步进滚动（过短会把正常单击误判为长按） */
const HOLD_SCROLL_DELAY_MS = 450;
/** 长按步进滚动的间隔（ms） */
const HOLD_STEP_INTERVAL_MS = 200;
/** 单次按键/点击的滚动距离倍率（相对 scrollRatio） */
const TAP_SCROLL_MULTIPLIER = 0.85;

function isAtBottom(container: HTMLElement): boolean {
  const { scrollTop, scrollHeight, clientHeight } = container;
  const distanceToBottom = scrollHeight - scrollTop - clientHeight;
  return distanceToBottom <= AT_BOTTOM_THRESHOLD;
}

export function useScrollKeyboard({
  viewMode,
  scrollRatio,
  scrollContainerRef,
  onLoadNextFolderAtBottom,
  isLoading = false,
}: UseScrollKeyboardOptions) {
  const holdDelayTimerRef = useRef<number | null>(null);
  const stepIntervalRef = useRef<number | null>(null);
  const pressedKeyRef = useRef<string | null>(null);
  const scrollDirectionRef = useRef<1 | -1 | null>(null);

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

  const clearStepInterval = useCallback(() => {
    if (stepIntervalRef.current !== null) {
      clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
    }
  }, []);

  const stopScrolling = useCallback(() => {
    clearHoldDelay();
    clearStepInterval();
    pressedKeyRef.current = null;
    scrollDirectionRef.current = null;
  }, [clearHoldDelay, clearStepInterval]);

  /** 步进式滚动：每隔 HOLD_STEP_INTERVAL_MS 滚动一个步长，替代连续平滑滚动避免头晕 */
  const startSteppedScroll = useCallback(
    (keyId: string, direction: 1 | -1) => {
      if (!scrollContainerRef.current) {
        return;
      }

      stopScrolling();
      pressedKeyRef.current = keyId;
      scrollDirectionRef.current = direction;

      const doStep = () => {
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

        const distance = getTapScrollDistance(container);
        container.scrollBy({
          top: distance * currentDirection,
          behavior: "smooth",
        });

        // 滚动后再次检查是否到底
        if (
          currentDirection === 1 &&
          onLoadNextFolderAtBottom &&
          !isLoading &&
          isAtBottom(container)
        ) {
          stopScrolling();
          onLoadNextFolderAtBottom();
        }
      };

      // 立即执行第一步，后续按间隔执行
      doStep();
      stepIntervalRef.current = window.setInterval(() => {
        doStep();
      }, HOLD_STEP_INTERVAL_MS);
    },
    [
      getTapScrollDistance,
      isLoading,
      onLoadNextFolderAtBottom,
      scrollContainerRef,
      stopScrolling,
    ],
  );

  const scheduleSteppedScroll = useCallback(
    (keyId: string, direction: 1 | -1) => {
      clearHoldDelay();
      holdDelayTimerRef.current = window.setTimeout(() => {
        holdDelayTimerRef.current = null;
        startSteppedScroll(keyId, direction);
      }, HOLD_SCROLL_DELAY_MS);
    },
    [clearHoldDelay, startSteppedScroll],
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
          if (stepIntervalRef.current !== null && pressedKeyRef.current === keyId) {
            return;
          }
          scheduleSteppedScroll(keyId, -1);
          return;
        }

        stopScrolling();
        pressedKeyRef.current = keyId;
        handleScrollUp();
        scheduleSteppedScroll(keyId, -1);
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
          if (stepIntervalRef.current !== null && pressedKeyRef.current === keyId) {
            return;
          }
          scheduleSteppedScroll(keyId, 1);
          return;
        }

        stopScrolling();
        pressedKeyRef.current = keyId;
        handleScrollDown();
        scheduleSteppedScroll(keyId, 1);
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
    scheduleSteppedScroll,
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
