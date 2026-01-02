interface ToolbarProps {
  onFolderSelect: () => void;
  currentFileName?: string;
  currentIndex: number;
  totalFiles: number;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export default function Toolbar({
  onFolderSelect,
  currentFileName,
  currentIndex,
  totalFiles,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom
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
      )}
    </div>
  );
}
