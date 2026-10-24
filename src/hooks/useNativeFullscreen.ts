import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { transitionNativeFullscreen } from "../utils/nativeFullscreen";

export function useNativeFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const transitionPending = useRef(false);
  const restoreMaximized = useRef(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let mounted = true;
    let unlisten: (() => void) | undefined;
    const sync = async () => {
      if (transitionPending.current) return;
      try {
        const actual = await appWindow.isFullscreen();
        if (mounted && !transitionPending.current) setIsFullscreen(actual);
      } catch (error) {
        console.error("读取窗口全屏状态失败:", error);
      }
    };

    void sync();
    void appWindow.onResized(() => { void sync(); }).then((stop) => {
      if (mounted) unlisten = stop;
      else stop();
    }).catch((error) => console.error("监听窗口尺寸失败:", error));

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (transitionPending.current) return;
    transitionPending.current = true;
    setFullscreenError(null);
    const appWindow = getCurrentWindow();

    try {
      const result = await transitionNativeFullscreen(appWindow, restoreMaximized.current);
      restoreMaximized.current = result.restoreMaximized;
      setIsFullscreen(result.fullscreen);
    } catch (error) {
      console.error("切换系统全屏失败:", error);
      setIsFullscreen(await appWindow.isFullscreen().catch(() => false));
      setFullscreenError(`系统全屏切换失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      transitionPending.current = false;
    }
  }, []);

  return { isFullscreen, fullscreenError, toggleFullscreen };
}
