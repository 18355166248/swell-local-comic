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
  const scrollIntervalRef = useRef<number | null>(null);
  const pressedKeyRef = useRef<string | null>(null);

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
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
      pressedKeyRef.current = null;
    }
  }, []);

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
        // 如果已经有定时器在运行，不重复创建
        if (scrollIntervalRef.current && pressedKeyRef.current === keyId) {
          return;
        }
        // 清除之前的定时器（如果有）
        stopScrolling();
        // 立即执行一次
        handleScrollUp();
        // 设置持续滚动
        pressedKeyRef.current = keyId;
        scrollIntervalRef.current = setInterval(() => {
          handleScrollUp();
        }, 100); // 每100ms滚动一次
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

        // 如果已经有定时器在运行，不重复创建
        if (scrollIntervalRef.current && pressedKeyRef.current === keyId) {
          return;
        }
        // 清除之前的定时器（如果有）
        stopScrolling();
        // 立即执行一次（若执行后到达底部，下次 interval 会触发加载）
        handleScrollDown();
        // 设置持续滚动
        pressedKeyRef.current = keyId;
        scrollIntervalRef.current = setInterval(() => {
          const c = scrollContainerRef.current;
          if (
            c &&
            onLoadNextFolderAtBottom &&
            !isLoading &&
            isAtBottom(c)
          ) {
            stopScrolling();
            onLoadNextFolderAtBottom();
            return;
          }
          handleScrollDown();
        }, 100); // 每100ms滚动一次
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

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      stopScrolling();
    };
  }, [
    viewMode,
    scrollRatio,
    handleScrollUp,
    handleScrollDown,
    stopScrolling,
    onLoadNextFolderAtBottom,
    isLoading,
  ]);

  return {
    handleScrollUp,
    handleScrollDown,
  };
}
