import { useEffect, useCallback } from "react";
import type { ViewMode } from "../types";
import { isKeyOwningWidget } from "../utils/keyboardTarget";

/** 阅读器会消费的按键；命中后先把键盘焦点收回画面，避免焦点留在工具按钮上。 */
const READER_SHORTCUT_KEYS: ReadonlySet<string> = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "PageUp", "PageDown", "Home", "End", " ",
  "a", "A", "d", "D", "f", "F", "m", "M", "w", "W", "s", "S",
  "+", "=", "-", "_", "0",
]);

interface UseKeyboardShortcutsOptions {
  viewMode: ViewMode;
  disableZoom?: boolean;
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
  /** 阅读键生效前调用：把键盘焦点放回阅读画面（清除按钮上的“选中”描边）。 */
  onEngageReader?: () => void;
}

/**
 * 全局键盘快捷键（W/S/↑/↓ 滚动由 useScrollKeyboard 处理）。
 */
export function useKeyboardShortcuts({
  viewMode,
  disableZoom = false,
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
  onEngageReader,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      if (document.querySelector("dialog[open]")) return;
      // 只有真正自己用方向键的控件（输入框、下拉、滑块…）才交还按键；
      // 按钮/链接不再吞掉翻页键，否则点过工具按钮后方向键会失效。
      if (isKeyOwningWidget(e.target)) return;
      if (!READER_SHORTCUT_KEYS.has(e.key)) return;

      // 方向键一旦用于阅读，就把焦点收回画面，避免按钮被 :focus-visible 高亮成“选中”。
      onEngageReader?.();

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
          if (!disableZoom) onZoomIn();
          break;
        case "-":
          e.preventDefault();
          if (!disableZoom) onZoomOut();
          break;
        case "0":
          e.preventDefault();
          if (!disableZoom) onResetZoom();
          break;
      }
    },
    [viewMode, disableZoom, onNextPage, onPrevPage, onZoomIn, onZoomOut, onResetZoom, onToggleFullscreen, onToggleViewMode, onGoToFirst, onGoToLast, onScrollUp, onScrollDown, onScrollStart, onScrollEnd, onEngageReader],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
