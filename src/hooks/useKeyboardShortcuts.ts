import { useEffect, useCallback } from "react";
import type { ViewMode } from "../types";

interface UseKeyboardShortcutsOptions {
  viewMode: ViewMode;
  onNextPage: () => void;
  onPrevPage: () => void;
  onLoadNextFolder: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToggleFullscreen: () => void;
  onToggleViewMode: () => void;
  onGoToFirst: () => void;
  onGoToLast: () => void;
}

/**
 * 全局键盘快捷键（W/S/↑/↓ 滚动由 useScrollKeyboard 处理）。
 */
export function useKeyboardShortcuts({
  viewMode,
  onNextPage,
  onPrevPage,
  onLoadNextFolder,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleFullscreen,
  onToggleViewMode,
  onGoToFirst,
  onGoToLast,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          onNextPage();
          break;
        case "ArrowLeft":
          e.preventDefault();
          onPrevPage();
          break;
        case "a":
        case "A":
          if (viewMode === "page") {
            e.preventDefault();
            onPrevPage();
          }
          break;
        case "d":
        case "D":
          if (viewMode === "page") {
            e.preventDefault();
            onNextPage();
          } else if (viewMode === "scroll") {
            e.preventDefault();
            onLoadNextFolder();
          }
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
          onGoToFirst();
          break;
        case "End":
          e.preventDefault();
          onGoToLast();
          break;
        case "PageUp":
          e.preventDefault();
          onPrevPage();
          break;
        case "PageDown":
          e.preventDefault();
          onNextPage();
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
    [viewMode, onNextPage, onPrevPage, onLoadNextFolder, onZoomIn, onZoomOut, onResetZoom, onToggleFullscreen, onToggleViewMode, onGoToFirst, onGoToLast],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
