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
    <div className="w-20 bg-gray-800/95 border-l border-gray-700 flex flex-col items-center py-4 gap-4">
      <button
        onClick={onPrevPage}
        disabled={currentIndex === 0}
        className="w-12 h-10 flex items-center justify-center rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-700 transition-colors"
        title="上一页 (← A)"
      >
        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex flex-col gap-1 min-w-0">
        <div className="text-xs text-gray-500 text-center px-1">
          {currentIndex + 1} / {files.length}
        </div>
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
                className={`w-10 h-8 text-sm rounded transition-colors ${
                  actualIndex === currentIndex
                    ? "bg-blue-600 text-white font-medium"
                    : "bg-gray-700/80 hover:bg-gray-600 text-gray-400 hover:text-gray-200"
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
        className="w-12 h-10 flex items-center justify-center rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-700 transition-colors"
        title="下一页 (→ D)"
      >
        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
