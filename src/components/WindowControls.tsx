import { getCurrentWindow } from "@tauri-apps/api/window";

export default function WindowControls({
  onBeforeClose,
}: {
  onBeforeClose?: () => void;
}) {
  const run = (action: "minimize" | "toggleMaximize" | "close") => {
    if (action === "close") onBeforeClose?.();
    void getCurrentWindow()[action]().catch((error) =>
      console.error("窗口操作失败:", error),
    );
  };

  return (
    <div className="flex shrink-0 items-center px-1" aria-label="窗口控制">
      <button
        type="button"
        aria-label="最小化"
        title="最小化"
        onClick={() => run("minimize")}
        className="h-10 w-9 text-gray-400 hover:bg-white/8 hover:text-white sm:w-11"
      >
        —
      </button>
      <button
        type="button"
        aria-label="最大化或还原"
        title="最大化 / 还原"
        onClick={() => run("toggleMaximize")}
        className="h-10 w-9 text-gray-400 hover:bg-white/8 hover:text-white sm:w-11"
      >
        □
      </button>
      <button
        type="button"
        aria-label="关闭窗口"
        title="关闭"
        onClick={() => run("close")}
        className="h-10 w-9 text-xl text-gray-400 hover:bg-red-600 hover:text-white sm:w-11"
      >
        ×
      </button>
    </div>
  );
}
