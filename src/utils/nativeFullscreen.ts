export interface FullscreenWindow {
  isFullscreen(): Promise<boolean>;
  isMaximized(): Promise<boolean>;
  unmaximize(): Promise<void>;
  maximize(): Promise<void>;
  setFullscreen(fullscreen: boolean): Promise<void>;
}

export interface FullscreenTransition {
  fullscreen: boolean;
  restoreMaximized: boolean;
}

export async function transitionNativeFullscreen(
  window: FullscreenWindow,
  restoreMaximized: boolean,
): Promise<FullscreenTransition> {
  if (await window.isFullscreen()) {
    await window.setFullscreen(false);
    if (await window.isFullscreen()) throw new Error("系统窗口仍处于全屏状态");
    if (restoreMaximized) await window.maximize();
    return { fullscreen: false, restoreMaximized: false };
  }

  const wasMaximized = await window.isMaximized();
  try {
    // Windows 从最大化状态直接切换时，窗口外框可能覆盖屏幕，而 WebView 仍停留在工作区高度。
    if (wasMaximized) await window.unmaximize();
    await window.setFullscreen(true);
    if (!(await window.isFullscreen())) throw new Error("系统窗口未进入全屏状态");
    return { fullscreen: true, restoreMaximized: wasMaximized };
  } catch (error) {
    if (wasMaximized && !(await window.isFullscreen().catch(() => false))) {
      await window.maximize().catch(() => {});
    }
    throw error;
  }
}
