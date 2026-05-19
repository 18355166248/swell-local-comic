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
  const pressedKeyRef = useRef<string | null>(null);
  const scrollDirectionRef = useRef<1 | -1 | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);

  const handleScrollUp = useCallback(() => {
    if (scrollContainerRef.current) {
      const containerHeight = scrollContainerRef.current.clientHeight;
      const scrollDistance = containerHeight * scrollRatio;
      scrollContainerRef.current.scrollBy({
        top: -scrollDistance,
        behavior: "smooth",
      });
    }
  }, [scrollRatio, scrollContainerRef]);

  const handleScrollDown = useCallback(() => {
    if (scrollContainerRef.current) {
      const containerHeight = scrollContainerRef.current.clientHeight;
      const scrollDistance = containerHeight * scrollRatio;
      scrollContainerRef.current.scrollBy({
        top: scrollDistance,
        behavior: "smooth",
      });
    }
  }, [scrollRatio, scrollContainerRef]);

  const stopScrolling = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    pressedKeyRef.current = null;
    scrollDirectionRef.current = null;
    lastFrameTimeRef.current = null;
  }, []);

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
        if (animationFrameRef.current !== null && pressedKeyRef.current === keyId) {
          return;
        }
        startContinuousScroll(keyId, -1);
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

        if (animationFrameRef.current !== null && pressedKeyRef.current === keyId) {
          return;
        }
        startContinuousScroll(keyId, 1);
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
    startContinuousScroll,
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
