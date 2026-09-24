import { useEffect, useCallback } from "react";
import type { ViewMode } from "../types";

interface UseKeyboardShortcutsOptions {
  viewMode: ViewMode;
  onNextPage: () => void;
  onPrevPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToggleFullscreen: () => void;
  onToggleViewMode: () => void;
  onGoToFirst: () => void;
  onGoToLast: () => void;
  onScrollUp: () => void;
  onScrollDown: () => void;
  onScrollStart: () => void;
  onScrollEnd: () => void;
}

/**
 * 全局键盘快捷键（W/S/↑/↓ 滚动由 useScrollKeyboard 处理）。
 */
export function useKeyboardShortcuts({
  viewMode,
  onNextPage,
  onPrevPage,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleFullscreen,
  onToggleViewMode,
  onGoToFirst,
  onGoToLast,
  onScrollUp,
  onScrollDown,
  onScrollStart,
  onScrollEnd,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        Boolean(target.closest("button, a, select, [role='button']"))
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          if (viewMode === "scroll") onScrollDown();
          else onNextPage();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (viewMode === "scroll") onScrollUp();
          else onPrevPage();
          break;
        case "a":
        case "A":
          e.preventDefault();
          if (viewMode === "scroll") onScrollUp();
          else onPrevPage();
          break;
        case "d":
        case "D":
          e.preventDefault();
          if (viewMode === "scroll") onScrollDown();
          else onNextPage();
          break;
        case "f":
        case "F":
          e.preventDefault();
          onToggleFullscreen();
          break;
        case "m":
        case "M":
          e.preventDefault();
          onToggleViewMode();
          break;
        case "Home":
          e.preventDefault();
          if (viewMode === "scroll") onScrollStart();
          else onGoToFirst();
          break;
        case "End":
          e.preventDefault();
          if (viewMode === "scroll") onScrollEnd();
          else onGoToLast();
          break;
        case "PageUp":
          e.preventDefault();
          if (viewMode === "scroll") onScrollUp();
          else onPrevPage();
          break;
        case "PageDown":
          e.preventDefault();
          if (viewMode === "scroll") onScrollDown();
          else onNextPage();
          break;
        case "+":
        case "=":
          e.preventDefault();
          onZoomIn();
          break;
        case "-":
          e.preventDefault();
          onZoomOut();
          break;
        case "0":
          e.preventDefault();
          onResetZoom();
          break;
      }
    },
    [viewMode, onNextPage, onPrevPage, onZoomIn, onZoomOut, onResetZoom, onToggleFullscreen, onToggleViewMode, onGoToFirst, onGoToLast, onScrollUp, onScrollDown, onScrollStart, onScrollEnd],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
