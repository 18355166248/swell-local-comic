import { useState } from "react";
import type { ComicFile } from "../types";
import { ChevronLeftIcon, ChevronRightIcon, NextChapterIcon } from "./Icons";

interface NavigationProps {
  files: ComicFile[];
  currentIndex: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onGoToPage: (index: number) => void;
  onLoadNextFolder?: () => void;
}

export default function Navigation({
  files,
  currentIndex,
  onPrevPage,
  onNextPage,
  onGoToPage,
  onLoadNextFolder,
}: NavigationProps) {
  const [jumpValue, setJumpValue] = useState("");

  if (files.length === 0) return null;

  const handleJump = () => {
    const page = Number(jumpValue);
    if (page >= 1 && page <= files.length) {
      onGoToPage(page - 1);
      setJumpValue("");
    }
  };

  const handleJumpKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleJump();
    }
  };

  return (
    <div className="w-20 bg-gray-800/95 border-l border-gray-700 flex flex-col items-center py-4 gap-4">
      <button
        onClick={onPrevPage}
        disabled={currentIndex === 0}
        className="w-12 h-10 flex items-center justify-center rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-700 transition-colors"
        title="上一页 (← A)"
      >
        <ChevronLeftIcon size={20} className="text-gray-300" />
      </button>

      <div className="flex flex-col gap-1 min-w-0 items-center">
        <div className="text-xs text-gray-500 text-center px-1">
          {currentIndex + 1} / {files.length}
        </div>
        <input
          type="number"
          min={1}
          max={files.length}
          value={jumpValue}
          onChange={(e) => setJumpValue(e.target.value)}
          onKeyDown={handleJumpKeyDown}
          onBlur={handleJump}
          placeholder="#"
          className="w-10 h-8 text-center text-xs bg-gray-700 rounded border border-gray-600 text-gray-200 outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          title="输入页号跳转"
        />
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
        className="w-12 h-10 flex items-center justify-center rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-700 transition-colors"
        title="下一页，最后一页时打开下一文件夹 (→ D)"
      >
        <ChevronRightIcon size={20} className="text-gray-300" />
      </button>

      {onLoadNextFolder && (
        <button
          onClick={onLoadNextFolder}
          className="w-12 h-10 flex items-center justify-center rounded-md bg-gray-600 hover:bg-gray-500 transition-colors"
          title="直接翻到下一文件夹"
        >
          <NextChapterIcon size={20} className="text-gray-300" />
        </button>
      )}
    </div>
  );
}
