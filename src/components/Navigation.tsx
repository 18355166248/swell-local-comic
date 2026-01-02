import type { ComicFile } from "../types";

interface NavigationProps {
  files: ComicFile[];
  currentIndex: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onGoToPage: (index: number) => void;
}

export default function Navigation({
  files,
  currentIndex,
  onPrevPage,
  onNextPage,
  onGoToPage,
}: NavigationProps) {
  if (files.length === 0) return null;

  return (
    <div className="bg-gray-800 p-4 flex items-center justify-center space-x-4">
      <button
        onClick={onPrevPage}
        disabled={currentIndex === 0}
        className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-2 rounded-lg transition-colors"
      >
        上一页
      </button>

      <div className="flex space-x-2">
        {files
          .slice(
            Math.max(0, currentIndex - 2),
            Math.min(files.length, currentIndex + 3)
          )
          .map((_, index) => {
            const actualIndex = Math.max(0, currentIndex - 2) + index;
            return (
              <button
                key={actualIndex}
                onClick={() => onGoToPage(actualIndex)}
                className={`px-3 py-1 rounded transition-colors ${
                  actualIndex === currentIndex
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                }`}
              >
                {actualIndex + 1}
              </button>
            );
          })}
      </div>

      <button
        onClick={onNextPage}
        disabled={currentIndex === files.length - 1}
        className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-2 rounded-lg transition-colors"
      >
        下一页
      </button>
    </div>
  );
}
