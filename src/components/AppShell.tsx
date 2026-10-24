import { NavLink, Outlet, useLocation } from "react-router";
import { ErrorBoundary } from "./ErrorBoundary";
import { getPrimaryNavItems } from "../utils/navigationUtils";
import WindowControls from "./WindowControls";

export default function AppShell() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-[#0c1117] text-[#e6edf5]">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-1 border-b border-white/10 bg-[#0c131c]/95 backdrop-blur sm:gap-5">
        <div
          data-tauri-drag-region
          className="flex items-center gap-2.5 pl-2 font-semibold tracking-tight sm:pl-5"
        >
          <img src="/app-icon.png" alt="" className="h-7 w-7 rounded-md" />
          <span className="hidden sm:inline">Swell Comic</span>
        </div>
        <nav className="flex h-full items-stretch gap-1" aria-label="主导航">
          {getPrimaryNavItems().map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => {
                const active = isActive || (item.to === "/" && pathname.startsWith("/library"));
                return `relative flex items-center px-2 text-sm transition-colors sm:px-4 ${
                  active
                    ? "bg-blue-500/10 text-blue-300 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-blue-500 sm:after:inset-x-4"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`;
              }}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div data-tauri-drag-region className="h-full min-w-0 flex-1" />
        <WindowControls />
      </header>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </div>
  );
}
