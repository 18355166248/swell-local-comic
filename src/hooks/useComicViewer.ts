import { useState, useCallback, useEffect } from "react";
import type { ComicFile, ComicViewerState, ViewMode, ReadingHistory } from "../types";
import { selectFolder, scanImageFiles, loadImageFile } from "../utils/fileUtils";
import { saveHistory } from "../utils/historyUtils";

export const useComicViewer = () => {
  const [files, setFiles] = useState<ComicFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("scroll");
  const [imageWidth, setImageWidth] = useState<number>(400);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [folderName, setFolderName] = useState<string>("");

  const handleFolderSelect = useCallback(async () => {
    try {
      const folderInfo = await selectFolder();
      if (!folderInfo) return;

      const fileList = await scanImageFiles(folderInfo.path);

      setFiles(fileList);
      setFolderName(folderInfo.name);

      // 检查是否有需要恢复的状态
      const restoreState = sessionStorage.getItem('restoreState');
      let restoreData: ReadingHistory | null = null;

      if (restoreState) {
        try {
          restoreData = JSON.parse(restoreState);
          sessionStorage.removeItem('restoreState');
        } catch (error) {
          console.error('解析恢复状态失败:', error);
        }
      }

      // 恢复或设置默认状态
      const targetIndex = restoreData?.currentIndex || 0;
      const targetZoom = restoreData?.zoom || 1;
      const targetViewMode = restoreData?.viewMode || viewMode;
      const targetImageWidth = restoreData?.imageWidth || imageWidth;

      setCurrentIndex(targetIndex);
      setZoom(targetZoom);
      setViewMode(targetViewMode);
      setImageWidth(targetImageWidth);

      if (fileList.length > 0) {
        const url = await loadImageFile(fileList[targetIndex]);
        setImageUrl(url);

        // 如果是滚动模式，预加载所有图片
        if (targetViewMode === "scroll") {
          const urls = await Promise.all(
            fileList.map((file) => loadImageFile(file))
          );
          setImageUrls(urls);
        }
      }
    } catch (error) {
      console.error("选择文件夹失败:", error);
    }
  }, [viewMode, imageWidth]);

  const loadImage = useCallback(async (file: ComicFile) => {
    try {
      const url = await loadImageFile(file);
      setImageUrl(url);
    } catch (error) {
      console.error("加载图片失败:", error);
    }
  }, []);

  const nextPage = useCallback(async () => {
    if (currentIndex < files.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      await loadImage(files[newIndex]);
    }
  }, [currentIndex, files, loadImage]);

  const prevPage = useCallback(async () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      await loadImage(files[newIndex]);
    }
  }, [currentIndex, files, loadImage]);

  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev * 1.2, 3));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev / 1.2, 0.5));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  // 键盘事件处理
  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          nextPage();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prevPage();
          break;
        case "+":
        case "=":
          e.preventDefault();
          zoomIn();
          break;
        case "-":
          e.preventDefault();
          zoomOut();
          break;
        case "0":
          e.preventDefault();
          resetZoom();
          break;
      }
    },
    [nextPage, prevPage, zoomIn, zoomOut, resetZoom]
  );

  // 添加事件监听器
  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleKeyPress]);

  // 切换视图模式
  const toggleViewMode = useCallback(async () => {
    const newMode: ViewMode = viewMode === "page" ? "scroll" : "page";
    setViewMode(newMode);

    // 切换到滚动模式时，加载所有图片
    if (newMode === "scroll" && files.length > 0 && imageUrls.length === 0) {
      const urls = await Promise.all(files.map((file) => loadImageFile(file)));
      setImageUrls(urls);
    }
  }, [viewMode, files, imageUrls.length]);

  // 设置图片宽度
  const setImageWidthValue = useCallback((width: number) => {
    setImageWidth(Math.max(200, Math.min(2000, width)));
  }, []);

  // 鼠标滚轮处理
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      // 在滚动模式下，如果按住Ctrl键，则缩放；否则滚动
      if (viewMode === "scroll") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.deltaY < 0) {
            zoomIn();
          } else {
            zoomOut();
          }
        }
        // 否则允许正常滚动
      } else {
        // 分页模式下，滚轮用于缩放
        e.preventDefault();
        if (e.deltaY < 0) {
          zoomIn();
        } else {
          zoomOut();
        }
      }
    },
    [viewMode, zoomIn, zoomOut]
  );

  // 视图模式切换时，加载所有图片
  useEffect(() => {
    if (viewMode === "scroll" && files.length > 0 && imageUrls.length === 0) {
      Promise.all(files.map((file) => loadImageFile(file))).then((urls) => {
        setImageUrls(urls);
      });
    }
  }, [viewMode, files, imageUrls.length]);


  // 保存阅读历史记录
  useEffect(() => {
    if (folderName && files.length > 0) {
      saveHistory({
        folderName,
        currentIndex,
        totalFiles: files.length,
        currentFileName: files[currentIndex]?.name,
        zoom,
        viewMode,
        imageWidth,
      });
    }
  }, [folderName, files, currentIndex, zoom, viewMode, imageWidth]);

  const state: ComicViewerState = {
    files,
    currentIndex,
    zoom,
    imageUrl,
    viewMode,
    imageWidth,
    imageUrls,
  };

  return {
    state,
    actions: {
      handleFolderSelect,
      nextPage,
      prevPage,
      zoomIn,
      zoomOut,
      resetZoom,
      handleWheel,
      toggleViewMode,
      setImageWidth: setImageWidthValue,
      goToPage: (index: number) => {
        if (index >= 0 && index < files.length) {
          setCurrentIndex(index);
          loadImage(files[index]);
        }
      },
    },
  };
};
