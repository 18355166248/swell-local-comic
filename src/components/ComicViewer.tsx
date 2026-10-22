import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useComicViewer } from "../hooks/useComicViewer";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import Toolbar from "./Toolbar";
import ImageViewer from "./ImageViewer";
import Navigation from "./Navigation";
import PageOverview from "./PageOverview";
import type { ChapterSequenceItem, ReadingHistory } from "../types";
import { normalizeLibraryPathId } from "../utils/libraryUtils";

export default function ComicViewer() {
  const { state, actions } = useComicViewer();
  const [searchParams, setSearchParams] = useSearchParams();
  const [restoreHistory, setRestoreHistory] = useState<ReadingHistory | null>(
    null,
  );
  const [imagesPerGroup, setImagesPerGroup] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPageOverview, setShowPageOverview] = useState(false);
  const [fullscreenImageFit, setFullscreenImageFit] = useState<
    "original" | "fit"
  >("original");
  const hasProcessedOpenFolder = useRef(false);
  const hasProcessedContinueReading = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(async () => {
    try {
      const window = getCurrentWindow();
      const willBeFullscreen = !isFullscreen;
      await window.setFullscreen(willBeFullscreen);
      setIsFullscreen(willBeFullscreen);
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isFullscreen && !document.querySelector("dialog[open]")) {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, toggleFullscreen]);

  // 全局键盘快捷键（←/A/D/空格/F/Home/End/+/-/0/M/PageUp/PageDown）
  const { goToPage } = actions;
  const { loadNextFolder } = actions;
  const { scrollRatio } = state;
  const goToFirst = useCallback(() => {
    if (state.files.length > 0) goToPage(0);
  }, [state.files.length, goToPage]);
  const goToLast = useCallback(() => {
    if (state.files.length > 0) goToPage(state.files.length - 1);
  }, [state.files.length, goToPage]);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (direction === 1 && container.scrollHeight - container.scrollTop - container.clientHeight <= 5) {
      loadNextFolder();
      return;
    }
    container.scrollBy({ top: direction * container.clientHeight * scrollRatio * 0.85, behavior: "smooth" });
  }, [loadNextFolder, scrollRatio]);

  const scrollToEdge = useCallback((edge: "start" | "end") => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: edge === "start" ? 0 : container.scrollHeight, behavior: "auto" });
  }, []);

  useKeyboardShortcuts({
    viewMode: state.viewMode,
    disableZoom: state.viewMode === "page" && isFullscreen && fullscreenImageFit === "fit",
    onNextPage: actions.nextPage,
    onPrevPage: actions.prevPage,
    onZoomIn: actions.zoomIn,
    onZoomOut: actions.zoomOut,
    onResetZoom: actions.resetZoom,
    onToggleFullscreen: toggleFullscreen,
    onToggleViewMode: actions.toggleViewMode,
    onGoToFirst: goToFirst,
    onGoToLast: goToLast,
    onScrollUp: () => scrollByPage(-1),
    onScrollDown: () => scrollByPage(1),
    onScrollStart: () => scrollToEdge("start"),
    onScrollEnd: () => scrollToEdge("end"),
  });

  const chapterSequence = (() => {
    const rawSequence = sessionStorage.getItem("comicChapterSequence");
    if (!rawSequence) {
      return [];
    }

    try {
      return JSON.parse(rawSequence) as ChapterSequenceItem[];
    } catch (error) {
      console.error("解析章节序列失败:", error);
      return [];
    }
  })();

  const currentChapterIndex = (() => {
    if (!state.folderPath) return -1;
    const currentPathId = normalizeLibraryPathId(state.folderPath);
    return chapterSequence.findIndex(
      (item) => normalizeLibraryPathId(item.path) === currentPathId,
    );
  })();

  const prevChapter = currentChapterIndex > 0 ? chapterSequence[currentChapterIndex - 1] : null;
  const nextChapter =
    currentChapterIndex >= 0 && currentChapterIndex < chapterSequence.length - 1
      ? chapterSequence[currentChapterIndex + 1]
      : null;

  const openChapterBySequence = useCallback(
    async (chapter: ChapterSequenceItem | null) => {
      if (!chapter) return;
      try {
        sessionStorage.removeItem("continueReading");
        setRestoreHistory(null);
        sessionStorage.setItem("openComicFolder", JSON.stringify(chapter));
        await actions.handleFolderSelect();
      } catch (error) {
        console.error("切换章节失败:", error);
      }
    },
    [actions],
  );

  useEffect(() => {
    const continueReading = sessionStorage.getItem("continueReading");
    if (!continueReading) return;

    try {
      const history: ReadingHistory = JSON.parse(continueReading);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRestoreHistory(history);
      if (history.files && history.files.length > 0) {
        sessionStorage.setItem("directRestore", JSON.stringify(history));
      }
    } catch (error) {
      console.error("解析历史记录失败:", error);
      sessionStorage.removeItem("continueReading");
    }
  }, []);

  const handleFolderSelect = useCallback(async () => {
    try {
      if (restoreHistory) {
        sessionStorage.setItem("restoreState", JSON.stringify(restoreHistory));
        sessionStorage.removeItem("continueReading");
        setRestoreHistory(null);
      }

      await actions.handleFolderSelect();
    } catch (error) {
      console.error("选择文件夹失败:", error);
    }
  }, [restoreHistory, actions]);

  useEffect(() => {
    const fromContinueReading = searchParams.get("fromContinueReading");
    const openFolder = searchParams.get("openFolder");

    if (openFolder !== "true") {
      hasProcessedOpenFolder.current = false;
    }

    if (openFolder === "true" && !hasProcessedOpenFolder.current) {
      hasProcessedOpenFolder.current = true;
      const executeOpenFolder = async () => {
        await actions.handleFolderSelect();
        setSearchParams({});
      };
      executeOpenFolder();
      return;
    }

    if (fromContinueReading !== "true") {
      hasProcessedContinueReading.current = false;
      return;
    }

    if (
      fromContinueReading === "true" &&
      !hasProcessedContinueReading.current
    ) {
      hasProcessedContinueReading.current = true;

      const executeContinueReading = async () => {
        const continueReading = sessionStorage.getItem("continueReading");
        if (continueReading) {
          try {
            const history: ReadingHistory = JSON.parse(continueReading);
            if (history.files && history.files.length > 0) {
              sessionStorage.setItem("directRestore", JSON.stringify(history));
              sessionStorage.removeItem("continueReading");
              setRestoreHistory(null);
              await actions.handleFolderSelect();
              setSearchParams({});
              return;
            }
          } catch (error) {
            console.error("解析历史记录失败:", error);
          }
        }

        await handleFolderSelect();
        setSearchParams({});
      };

      executeContinueReading();
    }
  }, [searchParams, setSearchParams, handleFolderSelect, actions]);

  const progressValue = state.loadingProgress || 0;
  const progressCount = state.imageUrls.length;
  const totalCount = state.files.length;

  return (
    <div className="flex h-screen bg-gray-900">
      {!isFullscreen && (
        <div className="fixed bottom-0 left-0 top-0 z-40">
          <Toolbar
            onBeforeLeave={actions.flushHistory}
            onFolderSelect={handleFolderSelect}
            onPrevChapter={() => void openChapterBySequence(prevChapter)}
            onNextChapter={() => void openChapterBySequence(nextChapter)}
            hasPrevChapter={Boolean(prevChapter)}
            hasNextChapter={Boolean(nextChapter)}
            currentChapterNumber={
              currentChapterIndex >= 0 ? currentChapterIndex + 1 : undefined
            }
            totalChapters={chapterSequence.length || undefined}
            prevChapterName={prevChapter?.name}
            nextChapterName={nextChapter?.name}
            folderName={state.folderName}
            folderPath={state.folderPath}
            currentFileName={state.files[state.currentIndex]?.name}
            currentIndex={state.currentIndex}
            totalFiles={state.files.length}
            zoom={state.zoom}
            onZoomIn={actions.zoomIn}
            onZoomOut={actions.zoomOut}
            onResetZoom={actions.resetZoom}
            viewMode={state.viewMode}
            onToggleViewMode={actions.toggleViewMode}
            imageWidth={state.imageWidth}
            onImageWidthChange={actions.setImageWidth}
            scrollRatio={state.scrollRatio}
            onScrollRatioChange={actions.setScrollRatio}
            imagesPerGroup={imagesPerGroup}
            onImagesPerGroupChange={setImagesPerGroup}
            onToggleFullscreen={toggleFullscreen}
          />
        </div>
      )}

      <div
        className={`relative flex min-w-0 flex-1 flex-col overflow-hidden ${isFullscreen ? "ml-0" : "ml-[320px]"}`}
      >
        {!isFullscreen && state.files.length > 0 && <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#0c1117] px-3 py-2 text-xs text-gray-300">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" disabled={state.isLoading} onClick={() => setShowPageOverview(true)} className="shrink-0 rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-blue-100 hover:bg-blue-500/20 disabled:opacity-40">图片页览</button>
            <span aria-live="polite" className="shrink-0 tabular-nums">第 {state.currentIndex + 1} / {state.files.length} 页</span>
            <span className="hidden max-w-48 truncate text-gray-500 xl:inline" title={state.files[state.currentIndex]?.name}>{state.files[state.currentIndex]?.name}</span>
          </div>
          <div role="group" aria-label="图片缩放" className="flex items-center gap-1">
            <span className="mr-2 hidden text-gray-500 2xl:inline">Ctrl + 滚轮缩放 · 放大后可拖拽</span>
            <button type="button" onClick={actions.zoomOut} disabled={state.zoom <= 0.5} aria-label="缩小图片" className="rounded-lg px-3 py-2 hover:bg-white/10 disabled:opacity-30">缩小</button>
            <button type="button" onClick={actions.resetZoom} title={state.viewMode === "page" ? "重置为适应预览区" : "重置缩放"} className="min-w-20 rounded-lg border border-white/10 px-3 py-2 hover:bg-white/10">{state.viewMode === "page" && state.zoom === 1 ? "适应屏幕" : `${Math.round(state.zoom * 100)}%`}</button>
            <button type="button" onClick={actions.zoomIn} disabled={state.zoom >= 3} aria-label="放大图片" className="rounded-lg px-3 py-2 hover:bg-white/10 disabled:opacity-30">放大</button>
          </div>
        </div>}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="relative flex-1 overflow-hidden">
            {restoreHistory && (
              <div className="absolute left-0 right-0 top-0 z-50 bg-blue-600 px-4 py-2 text-center text-sm text-white">
                从历史记录恢复: {restoreHistory.folderName} - 第{" "}
                {restoreHistory.currentIndex + 1} 页
                <button
                  onClick={() => {
                    setRestoreHistory(null);
                    sessionStorage.removeItem("continueReading");
                  }}
                  className="ml-4 text-blue-200 hover:text-white"
                >
                  ×
                </button>
              </div>
            )}

            <ImageViewer
              scrollContainerRef={scrollContainerRef}
              imageUrl={state.imageUrl}
              currentFileName={state.files[state.currentIndex]?.name}
              zoom={state.zoom}
              onWheel={actions.handleWheel}
              viewMode={state.viewMode}
              imageWidth={state.imageWidth}
              scrollRatio={state.scrollRatio}
              imageUrls={state.imageUrls}
              files={state.files}
              scrollPosition={
                state.viewMode === "scroll" ? state.scrollPosition : undefined
              }
              onScrollPositionChange={
                state.viewMode === "scroll"
                  ? actions.onScrollPositionChange
                  : undefined
              }
              onLoadNextFolder={
                state.viewMode === "scroll" ? actions.loadNextFolder : undefined
              }
              onCurrentImageChange={
                state.viewMode === "scroll"
                  ? actions.onCurrentImageChange
                  : undefined
              }
              onRetryImage={actions.retryImage}
              isLoading={state.isLoading}
              isImageLoading={state.isImageLoading}
              imagesPerGroup={imagesPerGroup}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              currentIndex={state.currentIndex}
              totalFiles={state.files.length}
              scrollPositionRatio={
                state.viewMode === "scroll" &&
                (state.scrollHeight ?? 0) > 0 &&
                state.scrollPosition !== undefined
                  ? state.scrollPosition / (state.scrollHeight ?? 1)
                  : undefined
              }
              scrollTargetIndex={state.scrollTargetIndex}
              scrollJumpRequest={state.scrollJumpRequest}
              fullscreenImageFit={fullscreenImageFit}
              onFullscreenImageFitChange={setFullscreenImageFit}
            />
          </div>

          {state.viewMode === "page" && !isFullscreen && (
            <Navigation
              files={state.files}
              currentIndex={state.currentIndex}
              onPrevPage={actions.prevPage}
              onNextPage={actions.nextPage}
              onGoToPage={actions.goToPage}
              onLoadNextFolder={actions.loadNextFolder}
            />
          )}
        </div>

        {state.isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="rounded-xl border border-white/10 bg-gray-800 px-6 py-5 text-center shadow-2xl">
              <div className="mb-4 text-lg text-white">正在加载图片...</div>
              <div className="mb-2 h-2 w-72 rounded-full bg-gray-700">
                <div
                  className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
              <div className="text-sm text-gray-300">
                {progressValue}% ({progressCount} / {totalCount})
              </div>
            </div>
          </div>
        )}
        {state.error && !state.isLoading && (
          <div role="alert" className="absolute bottom-4 left-1/2 z-50 max-w-[80%] -translate-x-1/2 rounded-lg border border-red-400/30 bg-gray-950/95 px-4 py-2 text-center text-sm text-red-100 shadow-xl">
            {state.error}
          </div>
        )}
        {showPageOverview && state.files.length > 0 && <PageOverview key={state.folderPath} files={state.files} imageUrls={state.imageUrls} currentIndex={state.currentIndex} onGoToPage={actions.goToPage} onClose={() => setShowPageOverview(false)} />}
      </div>
    </div>
  );
}
