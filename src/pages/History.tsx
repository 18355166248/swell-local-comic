import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import type { ReadingHistory } from "../types";
import {
  getAllHistory,
  deleteHistory,
  clearAllHistory,
} from "../utils/historyUtils";

export default function History() {
  const navigate = useNavigate();
  const [histories, setHistories] = useState<ReadingHistory[]>([]);

  useEffect(() => {
    loadHistories();
  }, []);

  const loadHistories = () => {
    const allHistories = getAllHistory();
    setHistories(allHistories);
  };

  const handleDelete = (folderPath: string, folderName: string) => {
    if (confirm(`确定要删除 "${folderName}" 的阅读历史吗？`)) {
      deleteHistory(folderPath);
      loadHistories();
    }
  };

  const handleClearAll = () => {
    if (confirm("确定要清空所有阅读历史吗？")) {
      clearAllHistory();
      loadHistories();
    }
  };

  const handleContinueReading = (history: ReadingHistory) => {
    // 将历史记录信息存储到 sessionStorage 中，以便 ComicViewer 恢复状态
    sessionStorage.setItem("continueReading", JSON.stringify(history));
    // 如果历史记录包含完整的文件夹信息，直接设置当前文件夹路径
    if (history.folderPath) {
      sessionStorage.setItem("currentFolderPath", history.folderPath);
    }
    // 携带参数表示是从继续阅读跳转过来的
    navigate("/?fromContinueReading=true");
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) {
      return `${days}天前`;
    }
    if (hours > 0) {
      return `${hours}小时前`;
    }
    if (minutes > 0) {
      return `${minutes}分钟前`;
    }
    return "刚刚";
  };

  const getProgress = (history: ReadingHistory) => {
    if (history.viewMode === "scroll" && history.scrollPosition !== undefined) {
      // 滚动模式：计算滚动进度
      if (history.scrollHeight && history.scrollHeight > 0) {
        const progress = Math.min(
          Math.round((history.scrollPosition / history.scrollHeight) * 100),
          100
        );
        return {
          type: "scroll",
          progress,
          position: history.scrollPosition,
          height: history.scrollHeight,
        };
      } else {
        // 如果没有高度信息，显示位置信息
        return {
          type: "scroll",
          progress: 0,
          position: history.scrollPosition,
        };
      }
    } else {
      // 分页模式：显示页面进度
      if (history.totalFiles === 0) return { type: "page", progress: 0 };
      return {
        type: "page",
        progress: Math.round(
          ((history.currentIndex + 1) / history.totalFiles) * 100
        ),
      };
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">阅读历史</h1>
          <div className="flex items-center space-x-4">
            {histories.length > 0 && (
              <button
                onClick={handleClearAll}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
              >
                清空全部
              </button>
            )}
            <button
              onClick={() => navigate("/")}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
            >
              返回阅读器
            </button>
          </div>
        </div>

        {histories.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">暂无阅读历史</p>
            <button
              onClick={() => navigate("/")}
              className="mt-4 bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors"
            >
              开始阅读
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {histories.map((history) => (
              <div
                key={history.folderName}
                className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors cursor-pointer group"
                onClick={() => handleContinueReading(history)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold truncate flex-1 mr-2">
                    {history.folderName}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(history.folderPath, history.folderName);
                    }}
                    className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100 transition-opacity"
                    title="删除"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span>阅读进度</span>
                    <span>
                      {(() => {
                        const progressInfo = getProgress(history);
                        if (progressInfo.type === "scroll") {
                          if (progressInfo.progress > 0) {
                            return `${progressInfo.progress}% (${progressInfo.position}px)`;
                          } else {
                            return `滚动位置: ${progressInfo.position}px`;
                          }
                        } else {
                          return `${history.currentIndex + 1} / ${
                            history.totalFiles
                          }`;
                        }
                      })()}
                    </span>
                  </div>

                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{
                        width: (() => {
                          const progressInfo = getProgress(history);
                          if (progressInfo.type === "scroll") {
                            return progressInfo.progress > 0
                              ? `${progressInfo.progress}%`
                              : "100%";
                          } else {
                            return `${progressInfo.progress}%`;
                          }
                        })(),
                      }}
                    />
                  </div>

                  {history.currentFileName && (
                    <p className="text-sm text-gray-400 truncate">
                      当前: {history.currentFileName}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      {formatTime(history.lastReadTime)}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleContinueReading(history);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded transition-colors opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      继续阅读
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
