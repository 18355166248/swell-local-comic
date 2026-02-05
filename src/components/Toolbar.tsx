import { useNavigate } from "react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ViewMode } from "../types";

interface ToolbarProps {
  onFolderSelect: () => void;
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
  imagesPerGroup: number;
  onImagesPerGroupChange: (count: number) => void;
}

export default function Toolbar({
  onFolderSelect,
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
  imagesPerGroup,
  onImagesPerGroupChange,
}: ToolbarProps) {
  const navigate = useNavigate();

  const handleClose = async () => {
    try {
      console.log("🔴 [窗口控制] 尝试关闭窗口");
      const window = getCurrentWindow();
      console.log("🔴 [窗口控制] 获取窗口对象成功:", window);
      await window.close();
      console.log("🔴 [窗口控制] 关闭窗口成功");
    } catch (error) {
      console.error("🔴 [窗口控制] 关闭窗口失败:", error);
    }
  };

  const handleMinimize = async () => {
    try {
      console.log("🔵 [窗口控制] 尝试最小化窗口");
      const window = getCurrentWindow();
      console.log("🔵 [窗口控制] 获取窗口对象成功:", window);
      await window.minimize();
      console.log("🔵 [窗口控制] 最小化窗口成功");
    } catch (error) {
      console.error("🔵 [窗口控制] 最小化窗口失败:", error);
    }
  };

  const handleMaximize = async () => {
    try {
      console.log("🟢 [窗口控制] 尝试最大化窗口");
      const window = getCurrentWindow();
      console.log("🟢 [窗口控制] 获取窗口对象成功:", window);
      await window.toggleMaximize();
      console.log("🟢 [窗口控制] 最大化窗口成功");
    } catch (error) {
      console.error("🟢 [窗口控制] 最大化窗口失败:", error);
    }
  };

  const handleDrag = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      console.log("🟡 [窗口控制] 尝试开始拖拽窗口");
      const window = getCurrentWindow();
      console.log("🟡 [窗口控制] 获取窗口对象成功:", window);
      await window.startDragging();
      console.log("🟡 [窗口控制] 开始拖拽窗口成功");
    } catch (error) {
      console.error("🟡 [窗口控制] 开始拖拽窗口失败:", error);
    }
  };

  return (
    <div className="bg-gray-800 h-full w-[280px] p-4 flex flex-col text-white border-r border-gray-700">
      {/* 窗口控制按钮 */}
      <div className="flex items-center justify-end space-x-2 mb-4 pb-4 border-b border-gray-700">
        <button
          onMouseDown={handleDrag}
          className="w-6 h-6 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded transition-colors cursor-move"
          title="拖拽窗口"
        >
          <span className="text-xs">⊞</span>
        </button>
        <button
          onClick={handleMinimize}
          className="w-6 h-6 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          title="最小化"
        >
          <span className="text-xs">−</span>
        </button>
        <button
          onClick={handleMaximize}
          className="w-6 h-6 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          title="最大化"
        >
          <span className="text-xs">□</span>
        </button>
        <button
          onClick={handleClose}
          className="w-6 h-6 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded transition-colors"
          title="关闭"
        >
          <span className="text-xs">×</span>
        </button>
      </div>

      <div className="flex flex-col space-y-4">
        <button
          onClick={onFolderSelect}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors w-full"
        >
          选择漫画文件夹
        </button>
        <button
          onClick={() => navigate("/history")}
          className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition-colors w-full"
        >
          阅读历史
        </button>
        {totalFiles > 0 && (
          <div className="text-sm text-gray-300 space-y-2">
            {viewMode === "scroll" ? (
              <>
                <div className="text-amber-300">
                  当前: {currentIndex + 1} / {totalFiles} 页
                </div>
                <div className="text-blue-500 break-words">
                  文件: {currentFileName}
                </div>
              </>
            ) : (
              <div>
                {currentIndex + 1} / {totalFiles} - {currentFileName}
              </div>
            )}
          </div>
        )}
      </div>

      {totalFiles > 0 && (
        <div className="flex flex-col space-y-4 mt-6 pt-6 border-t border-gray-700">
          <button
            onClick={onToggleViewMode}
            className={`px-3 py-2 rounded transition-colors w-full ${
              viewMode === "scroll"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
            title={viewMode === "scroll" ? "切换到分页模式" : "切换到滚动模式"}
          >
            {viewMode === "scroll" ? "📜 滚动" : "📄 分页"}
          </button>

          {viewMode === "scroll" && (
            <>
              <div className="flex flex-col space-y-2">
                <label className="text-sm text-gray-300">宽度:</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="200"
                    max="2000"
                    step="50"
                    value={imageWidth}
                    onChange={(e) => onImageWidthChange(Number(e.target.value))}
                    className="bg-gray-700 text-white px-2 py-1 rounded w-full text-sm"
                  />
                  <span className="text-sm text-gray-400">px</span>
                </div>
              </div>
              <div className="flex flex-col space-y-2">
                <label className="text-sm text-gray-300">每组:</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    step="1"
                    value={imagesPerGroup}
                    onChange={(e) =>
                      onImagesPerGroupChange(Number(e.target.value))
                    }
                    className="bg-gray-700 text-white px-2 py-1 rounded w-full text-sm"
                    title="每组图片数量，默认1（每张图片单独显示），可以配置成5（每5张合成一张）"
                  />
                  <span className="text-sm text-gray-400">张</span>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col space-y-2">
            <label className="text-sm text-gray-300">缩放:</label>
            <div className="flex items-center space-x-2">
              <button
                onClick={onZoomOut}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition-colors flex-1"
              >
                缩小
              </button>
              <button
                onClick={onResetZoom}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition-colors flex-1"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={onZoomIn}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition-colors flex-1"
              >
                放大
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
