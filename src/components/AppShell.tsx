import { useMemo } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { ErrorBoundary } from "./ErrorBoundary";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getPrimaryNavItems } from "../utils/navigationUtils";

const routeMeta: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "书库",
    subtitle: "管理作品目录，继续最近阅读。",
  },
  "/history": {
    title: "阅读历史",
    subtitle: "回到上次停下的位置。",
  },
  "/library": {
    title: "目录预览",
    subtitle: "浏览章节结构，再进入阅读器。",
  },
};

function WindowControlButton({
  label,
  title,
  tone = "default",
  onClick,
}: {
  label: string;
  title: string;
  tone?: "default" | "danger";
  onClick: () => Promise<void>;
}) {
  return (
    <button
      title={title}
      onClick={() => {
        void onClick().catch((err) =>
          console.error(`[WindowControlButton] ${title} 失败:`, err),
        );
      }}
      className={`flex h-8 w-10 items-center justify-center rounded-md text-sm transition-colors ${
        tone === "danger"
          ? "text-gray-300 hover:bg-red-600 hover:text-white"
          : "text-gray-400 hover:bg-white/8 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

export default function AppShell() {
  const location = useLocation();
  const shellMeta = useMemo(() => {
    if (location.pathname.startsWith("/library")) {
      return routeMeta["/library"];
    }
    return routeMeta[location.pathname] ?? routeMeta["/"];
  }, [location.pathname]);

  const handleMinimize = async () => {
    await getCurrentWindow().minimize();
  };

  const handleToggleMaximize = async () => {
    await getCurrentWindow().toggleMaximize();
  };

  const handleClose = async () => {
    await getCurrentWindow().close();
  };

  return (
    <div className="min-h-screen bg-[#0c1117] text-white">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0a0f14]/92 backdrop-blur">
        <div className="flex h-11 items-center border-b border-white/6">
          <div
            data-tauri-drag-region
            className="flex min-w-0 flex-1 items-center gap-3 px-4"
          >
            <img
              src="/app-icon.png"
              alt=""
              className="h-6 w-6 shrink-0 rounded-md object-cover"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-100">
                Swell Comic
              </div>
              <div className="truncate text-[11px] text-gray-500">
                {shellMeta.subtitle}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2">
            <WindowControlButton
              label="—"
              title="最小化"
              onClick={handleMinimize}
            />
            <WindowControlButton
              label="□"
              title="最大化 / 还原"
              onClick={handleToggleMaximize}
            />
            <WindowControlButton
              label="×"
              title="关闭"
              tone="danger"
              onClick={handleClose}
            />
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
          <div className="min-w-0">
            <div className="text-xl font-semibold tracking-tight text-gray-50">
              {shellMeta.title}
            </div>
            <div className="mt-1 text-sm text-gray-400">
              {shellMeta.subtitle}
            </div>
          </div>
          <nav className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
            {getPrimaryNavItems().map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-blue-500 text-white"
                      : "text-gray-300 hover:bg-white/8 hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_42%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_34%)]" />
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  );
}
