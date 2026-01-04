import { useState, useEffect } from "react";
import { useComicViewer } from "../hooks/useComicViewer";
import Toolbar from "./Toolbar";
import ImageViewer from "./ImageViewer";
import Navigation from "./Navigation";
import type { ReadingHistory } from "../types";

export default function ComicViewer() {
  const { state, actions } = useComicViewer();
  const [restoreHistory, setRestoreHistory] = useState<ReadingHistory | null>(
    null
  );

  useEffect(() => {
    // 检查是否有需要恢复的历史记录
    const continueReading = sessionStorage.getItem("continueReading");
    if (continueReading) {
      try {
        const history: ReadingHistory = JSON.parse(continueReading);
        setRestoreHistory(history);
      } catch (error) {
        console.error("解析历史记录失败:", error);
        sessionStorage.removeItem("continueReading");
      }
    }
  }, []);

  const handleFolderSelect = async () => {
    try {
      if (restoreHistory) {
        // 如果有恢复的历史记录，设置一个标志来恢复状态
        sessionStorage.setItem("restoreState", JSON.stringify(restoreHistory));
        sessionStorage.removeItem("continueReading");
        setRestoreHistory(null);
      }

      // 调用文件夹选择逻辑
      await actions.handleFolderSelect();
    } catch (error) {
      console.error("选择文件夹失败:", error);
    }
  };

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* 恢复提示 */}
      {restoreHistory && (
        <div className="bg-blue-600 text-white px-4 py-2 text-center text-sm">
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
      />

      <div className="flex-1 overflow-hidden relative">
        <ImageViewer
          imageUrl={state.imageUrl}
          currentFileName={state.files[state.currentIndex]?.name}
          zoom={state.zoom}
          onWheel={actions.handleWheel}
          viewMode={state.viewMode}
          imageWidth={state.imageWidth}
          imageUrls={state.imageUrls}
          files={state.files}
        />
      </div>

      {state.viewMode === "page" && (
        <Navigation
          files={state.files}
          currentIndex={state.currentIndex}
          onPrevPage={actions.prevPage}
          onNextPage={actions.nextPage}
          onGoToPage={actions.goToPage}
        />
      )}
    </div>
  );
}
