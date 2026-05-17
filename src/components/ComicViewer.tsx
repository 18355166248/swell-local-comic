import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useComicViewer } from "../hooks/useComicViewer";
import Toolbar from "./Toolbar";
import ImageViewer from "./ImageViewer";
import Navigation from "./Navigation";
import type { ReadingHistory } from "../types";

export default function ComicViewer() {
  const { state, actions } = useComicViewer();
  const [searchParams, setSearchParams] = useSearchParams();
  const [restoreHistory, setRestoreHistory] = useState<ReadingHistory | null>(
    null
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, toggleFullscreen]);

  useEffect(() => {
    // 检查是否有需要恢复的历史记录
    const continueReading = sessionStorage.getItem("continueReading");
    if (continueReading) {
      try {
        const history: ReadingHistory = JSON.parse(continueReading);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRestoreHistory(history);
        // 如果历史记录包含完整的文件列表，可以直接恢复
        if (history.files && history.files.length > 0) {
          sessionStorage.setItem("directRestore", JSON.stringify(history));
        }
      } catch (error) {
        console.error("解析历史记录失败:", error);
        sessionStorage.removeItem("continueReading");
      }
    }
  }, []);

  const handleFolderSelect = useCallback(async () => {
    try {
      if (restoreHistory) {
        // 如果有恢复的历史记录，设置一个标志来恢复状态
        sessionStorage.setItem("restoreState", JSON.stringify(restoreHistory));
        sessionStorage.removeItem("continueReading");
        setRestoreHistory(null);
        return;
      }

      // 调用文件夹选择逻辑
      await actions.handleFolderSelect();
    } catch (error) {
      console.error("选择文件夹失败:", error);
    }
  }, [restoreHistory, actions]);

  useEffect(() => {
    // 判断如果是从继续阅读过来的，主动执行 handleFolderSelect
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

    // 如果查询参数变化了（从 true 变为其他值），重置标志
    if (fromContinueReading !== "true") {
      hasProcessedContinueReading.current = false;
      return;
    }

    if (
      fromContinueReading === "true" &&
      !hasProcessedContinueReading.current
    ) {
      // 标记为已处理，防止重复执行
      hasProcessedContinueReading.current = true;

      // 先执行逻辑，再移除查询参数，避免触发重复执行
      const executeContinueReading = async () => {
        // 检查是否有完整的历史记录可以直接恢复
        const continueReading = sessionStorage.getItem("continueReading");
        if (continueReading) {
          try {
            const history: ReadingHistory = JSON.parse(continueReading);
            // 如果历史记录包含完整的文件列表，直接设置 directRestore，不需要选择文件夹
            if (history.files && history.files.length > 0) {
              sessionStorage.setItem("directRestore", JSON.stringify(history));
              sessionStorage.removeItem("continueReading");
              setRestoreHistory(null);
              // 直接调用 handleFolderSelect，它会检测到 directRestore 并直接恢复
              await actions.handleFolderSelect();
              // 移除查询参数
              setSearchParams({});
              return;
            }
          } catch (error) {
            console.error("解析历史记录失败:", error);
          }
        }

        // 如果没有完整的历史记录，需要执行文件夹选择
        await handleFolderSelect();
        // 移除查询参数
        setSearchParams({});
      };

      executeContinueReading();
    }
  }, [searchParams, setSearchParams, handleFolderSelect, actions]);

  return (
    <div className="h-screen bg-gray-900 flex">
      {!isFullscreen && (
        <div className="fixed left-0 top-0 bottom-0 z-40">
          <Toolbar
          onFolderSelect={handleFolderSelect}
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
          imagesPerGroup={imagesPerGroup}
          onImagesPerGroupChange={setImagesPerGroup}
          onToggleFullscreen={toggleFullscreen}
        />
        </div>
      )}

      <div
        className={`flex-1 overflow-hidden relative ${isFullscreen ? "ml-0" : "ml-[280px]"}`}
      >
        {/* 恢复提示 */}
        {restoreHistory && (
          <div className="absolute top-0 left-0 right-0 bg-blue-600 text-white px-4 py-2 text-center text-sm z-50">
            从历史记录恢复: {restoreHistory.folderName} - 第{" "}
            {restoreHistory.currentIndex + 1} 页
            <button
              onClick={() => {  
                setRestoreHistory(null);
                sessionStorage.removeItem("continueReading");
              }}
              className="ml-4 text-blue-200 hover:text-white"
            >
              ✕
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
        {state.isLoading && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <div className="text-white text-lg mb-4">正在加载图片...</div>
              <div className="w-64 bg-gray-700 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${state.loadingProgress || 0}%` }}
                />
              </div>
              <div className="text-gray-300 text-sm">
                {state.loadingProgress || 0}% ({state.imageUrls.length} /{" "}
                {state.files.length})
              </div>
            </div>
          </div>
        )}
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
  );
}
