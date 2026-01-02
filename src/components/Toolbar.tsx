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
  onImageWidthChange
}: ToolbarProps) {
  return (
    <div className="bg-gray-800 p-4 flex items-center justify-between text-white">
      <div className="flex items-center space-x-4">
        <button
          onClick={onFolderSelect}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
        >
          选择漫画文件夹
        </button>
        {totalFiles > 0 && (
          <span className="text-sm text-gray-300">
            {currentIndex + 1} / {totalFiles} - {currentFileName}
          </span>
        )}
      </div>

      {totalFiles > 0 && (
        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleViewMode}
            className={`px-3 py-1 rounded transition-colors ${
              viewMode === 'scroll'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={viewMode === 'scroll' ? '切换到分页模式' : '切换到滚动模式'}
          >
            {viewMode === 'scroll' ? '📜 滚动' : '📄 分页'}
          </button>

          {viewMode === 'scroll' && (
            <div className="flex items-center space-x-2 ml-2 pl-2 border-l border-gray-600">
              <label className="text-sm text-gray-300">宽度:</label>
              <input
                type="number"
                min="200"
                max="2000"
                step="50"
                value={imageWidth}
                onChange={(e) => onImageWidthChange(Number(e.target.value))}
                className="bg-gray-700 text-white px-2 py-1 rounded w-20 text-sm"
              />
              <span className="text-sm text-gray-400">px</span>
            </div>
          )}

          <div className="flex items-center space-x-2 ml-2 pl-2 border-l border-gray-600">
            <button
              onClick={onZoomOut}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition-colors"
            >
              缩小
            </button>
            <button
              onClick={onResetZoom}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition-colors"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={onZoomIn}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition-colors"
            >
              放大
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
