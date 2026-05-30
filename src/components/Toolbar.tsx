import { useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useNavigate } from "react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ViewMode } from "../types";

interface ToolbarProps {
  onFolderSelect: () => void;
  onPrevChapter?: () => void;
  onNextChapter?: () => void;
  hasPrevChapter?: boolean;
  hasNextChapter?: boolean;
  currentChapterNumber?: number;
  totalChapters?: number;
  prevChapterName?: string;
  nextChapterName?: string;
  folderName?: string;
  folderPath?: string;
  currentFileName?: string;
  currentIndex: number;
  totalFiles: number;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  viewMode: ViewMode;
  onToggleViewMode: () => void;
  imageWidth: number;
  onImageWidthChange: (width: number) => void;
  scrollRatio: number;
  onScrollRatioChange: (ratio: number) => void;
  imagesPerGroup: number;
  onImagesPerGroupChange: (count: number) => void;
  onToggleFullscreen?: () => void;
}

const modeLabel: Record<ViewMode, string> = {
  page: "分页",
  scroll: "滚动",
};

const formatProgress = (currentIndex: number, totalFiles: number) => {
  if (totalFiles <= 0) return "未打开";
  return `${currentIndex + 1} / ${totalFiles}`;
};

const clampNumericInput = (
  value: number,
  min: number,
  max: number,
  fallback: number,
) => {
  if (Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
};

export default function Toolbar({
  onFolderSelect,
  onPrevChapter,
  onNextChapter,
  hasPrevChapter = false,
  hasNextChapter = false,
  currentChapterNumber,
  totalChapters,
  prevChapterName,
  nextChapterName,
  folderName,
  folderPath,
  currentFileName,
  currentIndex,
  totalFiles,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  viewMode,
  onToggleViewMode,
  imageWidth,
  onImageWidthChange,
  scrollRatio,
  onScrollRatioChange,
  imagesPerGroup,
  onImagesPerGroupChange,
  onToggleFullscreen,
}: ToolbarProps) {
  const navigate = useNavigate();
  const hasFiles = totalFiles > 0;
  const [isPathExpanded, setIsPathExpanded] = useState(false);
  const [isScrollSettingsOpen, setIsScrollSettingsOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");

  useEffect(() => {
    if (copyState === "idle") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch (error) {
      console.error("关闭窗口失败:", error);
    }
  };

  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (error) {
      console.error("最小化窗口失败:", error);
    }
  };

  const handleMaximize = async () => {
    try {
      await getCurrentWindow().toggleMaximize();
    } catch (error) {
      console.error("切换窗口尺寸失败:", error);
    }
  };

  const handleDrag = async (event: ReactMouseEvent) => {
    event.preventDefault();
    try {
      await getCurrentWindow().startDragging();
    } catch (error) {
      console.error("拖拽窗口失败:", error);
    }
  };

  const handleCopyPath = async () => {
    if (!folderPath) return;
    try {
      await navigator.clipboard.writeText(folderPath);
      setCopyState("done");
    } catch (error) {
      console.error("复制路径失败:", error);
      setCopyState("error");
    }
  };

  const showScrollSettings = viewMode === "scroll" && isScrollSettingsOpen;

  return (
    <aside className="flex h-full w-[320px] flex-col border-r border-white/10 bg-[#0c1117] text-white">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div
            onMouseDown={handleDrag}
            className="flex min-w-0 flex-1 cursor-move items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2"
            title="拖拽窗口"
          >
            <span className="text-sm text-gray-400">阅读器</span>
            {hasFiles && (
              <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-200">
                {modeLabel[viewMode]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleMinimize}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-gray-300 transition-colors hover:bg-white/[0.08] hover:text-white"
              title="最小化"
            >
              -
            </button>
            <button
              onClick={handleMaximize}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-gray-300 transition-colors hover:bg-white/[0.08] hover:text-white"
              title="最大化 / 还原"
            >
              □
            </button>
            <button
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600/85 text-white transition-colors hover:bg-red-500"
              title="关闭"
            >
              ×
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate("/")}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-gray-100 transition-colors hover:bg-white/[0.08]"
          >
            返回书库
          </button>
          <button
            onClick={onFolderSelect}
            className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            打开目录
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-gray-100">当前阅读</div>
              <div className="mt-1 text-xs text-gray-500">优先看位置，再调参数</div>
            </div>
            {hasFiles && (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-200">
                {formatProgress(currentIndex, totalFiles)}
              </span>
            )}
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                章节目录
              </div>
              <div className="rounded-xl bg-[#111821] px-3 py-2 text-gray-100">
                <div className="truncate font-medium">
                  {folderName || "尚未打开目录"}
                </div>
                <div
                  className={`mt-1 text-xs text-gray-500 ${
                    isPathExpanded ? "break-all" : "truncate"
                  }`}
                  title={folderPath}
                >
                  {folderPath || "打开章节后会在这里显示完整路径"}
                </div>
                {folderPath && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => setIsPathExpanded((prev) => !prev)}
                      className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-xs text-gray-200 transition-colors hover:bg-white/[0.08]"
                    >
                      {isPathExpanded ? "收起路径" : "展开路径"}
                    </button>
                    <button
                      onClick={handleCopyPath}
                      className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-xs text-gray-200 transition-colors hover:bg-white/[0.08]"
                    >
                      {copyState === "done"
                        ? "已复制"
                        : copyState === "error"
                          ? "复制失败"
                          : "复制路径"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                章节导航
              </div>
              <div className="space-y-2 rounded-xl bg-[#111821] p-2">
                <button
                  onClick={onPrevChapter}
                  disabled={!hasPrevChapter}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-200 transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                  title={prevChapterName || "没有上一章节"}
                >
                  <div className="text-xs text-gray-500">上一章节</div>
                  <div className="mt-1 truncate">
                    {prevChapterName || "已到第一章"}
                  </div>
                </button>

                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm text-blue-50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-blue-200/70">当前章节</div>
                    {currentChapterNumber && totalChapters ? (
                      <div className="text-xs text-blue-100/80">
                        第 {currentChapterNumber} / {totalChapters} 章
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate font-medium">
                    {folderName || "尚未打开目录"}
                  </div>
                </div>

                <button
                  onClick={onNextChapter}
                  disabled={!hasNextChapter}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-200 transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                  title={nextChapterName || "没有下一章节"}
                >
                  <div className="text-xs text-gray-500">下一章节</div>
                  <div className="mt-1 truncate">
                    {nextChapterName || "已到最后一章"}
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#111821] px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  阅读模式
                </div>
                <div className="mt-1 font-medium text-gray-100">
                  {modeLabel[viewMode]}
                </div>
              </div>
              <div className="rounded-xl bg-[#111821] px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  当前图片
                </div>
                <div className="mt-1 font-medium text-gray-100">
                  {hasFiles ? currentFileName || "未命名图片" : "未打开"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {hasFiles && (
          <>
            <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-3 text-sm font-medium text-gray-100">显示方式</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => viewMode === "scroll" || onToggleViewMode()}
                  className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                    viewMode === "scroll"
                      ? "bg-blue-600 text-white"
                      : "bg-[#111821] text-gray-300 hover:bg-white/[0.08]"
                  }`}
                >
                  滚动
                </button>
                <button
                  onClick={() => viewMode === "page" || onToggleViewMode()}
                  className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                    viewMode === "page"
                      ? "bg-blue-600 text-white"
                      : "bg-[#111821] text-gray-300 hover:bg-white/[0.08]"
                  }`}
                >
                  分页
                </button>
              </div>

              {onToggleFullscreen && (
                <button
                  onClick={onToggleFullscreen}
                  className="mt-3 w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 transition-colors hover:bg-amber-500/20"
                  title="全屏看图 (ESC 退出)"
                >
                  全屏查看
                </button>
              )}
            </section>

            <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-gray-100">缩放</div>
                <button
                  onClick={onResetZoom}
                  className="rounded-lg bg-[#111821] px-2.5 py-1 text-xs text-gray-200 transition-colors hover:bg-white/[0.08]"
                >
                  {Math.round(zoom * 100)}%
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onZoomOut}
                  className="rounded-xl bg-[#111821] px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-white/[0.08]"
                >
                  缩小
                </button>
                <button
                  onClick={onZoomIn}
                  className="rounded-xl bg-[#111821] px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-white/[0.08]"
                >
                  放大
                </button>
              </div>
            </section>

            {viewMode === "scroll" && (
              <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <button
                  onClick={() => setIsScrollSettingsOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-100">滚动模式</div>
                    <div className="mt-1 text-xs text-gray-500">
                      平时不常改，按需展开
                    </div>
                  </div>
                  <span className="text-sm text-gray-400">
                    {isScrollSettingsOpen ? "收起" : "展开"}
                  </span>
                </button>

                {showScrollSettings && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                        图片宽度
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="200"
                          max="2000"
                          step="50"
                          value={imageWidth}
                          onChange={(event) =>
                            onImageWidthChange(
                              clampNumericInput(
                                Number(event.target.value),
                                200,
                                2000,
                                imageWidth,
                              ),
                            )
                          }
                          className="w-full rounded-xl border border-white/10 bg-[#111821] px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                        />
                        <span className="text-xs text-gray-500">px</span>
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                        每组张数
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="20"
                          step="1"
                          value={imagesPerGroup}
                          onChange={(event) =>
                            onImagesPerGroupChange(
                              clampNumericInput(
                                Number(event.target.value),
                                1,
                                20,
                                imagesPerGroup,
                              ),
                            )
                          }
                          className="w-full rounded-xl border border-white/10 bg-[#111821] px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                        />
                        <span className="text-xs text-gray-500">张</span>
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                        滚动步长（W/S/↑/↓）
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="15"
                          max="100"
                          step="5"
                          value={Math.round(scrollRatio * 100)}
                          onChange={(event) =>
                            onScrollRatioChange(Number(event.target.value) / 100)
                          }
                          className="flex-1 h-2 rounded-lg appearance-none bg-[#111821] cursor-pointer accent-blue-500"
                        />
                        <span className="w-10 text-right text-xs text-gray-300 tabular-nums">
                          {Math.round(scrollRatio * 100)}%
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between text-[10px] text-gray-600">
                        <span>15%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-3 text-sm font-medium text-gray-100">快捷键</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                <div className="rounded-xl bg-[#111821] px-3 py-2">← / A 上一页</div>
                <div className="rounded-xl bg-[#111821] px-3 py-2">→ / D 下一页</div>
                <div className="rounded-xl bg-[#111821] px-3 py-2">W / ↑ 向上滚动</div>
                <div className="rounded-xl bg-[#111821] px-3 py-2">S / ↓ 向下滚动</div>
                <div className="rounded-xl bg-[#111821] px-3 py-2">空格 下一页</div>
                <div className="rounded-xl bg-[#111821] px-3 py-2">ESC 退出全屏</div>
                <div className="rounded-xl bg-[#111821] px-3 py-2">+ 放大</div>
                <div className="rounded-xl bg-[#111821] px-3 py-2">- 缩小</div>
              </div>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
