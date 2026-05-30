import { useEffect, useCallback } from "react";
import type { ViewMode } from "../types";

interface UseKeyboardShortcutsOptions {
  viewMode: ViewMode;
  /** 下一页（page 模式或空格键） */
  onNextPage: () => void;
  /** 上一页 */
  onPrevPage: () => void;
  /** 加载下一文件夹（scroll 模式 D 键） */
  onLoadNextFolder: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

/**
 * 全局键盘快捷键（不含 W/S/↑/↓ 滚动 — 这些由 useScrollKeyboard 处理）。
 * - page 模式：←/A 上一页，→/D/空格 下一页
 * - scroll 模式：D 加载下一文件夹
 * - 通用：+/-/0 缩放
 */
export function useKeyboardShortcuts({
  viewMode,
  onNextPage,
  onPrevPage,
  onLoadNextFolder,
  onZoomIn,
  onZoomOut,
  onResetZoom,
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
    [viewMode, onNextPage, onPrevPage, onLoadNextFolder, onZoomIn, onZoomOut, onResetZoom],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
