import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useComicViewer } from "../hooks/useComicViewer";
import Toolbar from "./Toolbar";
import ImageViewer from "./ImageViewer";
import Navigation from "./Navigation";
import type { ReadingHistory } from "../types";
import { normalizeLibraryPathId } from "../utils/libraryUtils";

interface ChapterSequenceItem {
  name: string;
  path: string;
}

export default function ComicViewer() {
  const { state, actions } = useComicViewer();
  const [searchParams, setSearchParams] = useSearchParams();
  const [restoreHistory, setRestoreHistory] = useState<ReadingHistory | null>(
    null,
  );
  const [imagesPerGroup, setImagesPerGroup] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenImageFit, setFullscreenImageFit] = useState<
    "original" | "fit"
  >("original");
  const hasProcessedOpenFolder = useRef(false);
  const hasProcessedContinueReading = useRef(false);

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
      if (event.key === "Escape" && isFullscreen) {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, toggleFullscreen]);

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
      sessionStorage.removeItem("continueReading");
      setRestoreHistory(null);
      sessionStorage.setItem("openComicFolder", JSON.stringify(chapter));
      await actions.handleFolderSelect();
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
        return;
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
        className={`relative flex-1 overflow-hidden ${isFullscreen ? "ml-0" : "ml-[320px]"}`}
      >
        <div className="flex h-full overflow-hidden">
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
              isLoading={state.isLoading}
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
      </div>
    </div>
  );
}
