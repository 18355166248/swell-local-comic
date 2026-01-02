import { useState, useCallback, useEffect } from "react";
import type { ComicFile, ComicViewerState } from "../types";
import { scanImageFiles, loadImageFile } from "../utils/fileUtils";

export const useComicViewer = () => {
  const [files, setFiles] = useState<ComicFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [imageUrl, setImageUrl] = useState<string>("");

  const handleFolderSelect = useCallback(async () => {
    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker();
      const fileList = await scanImageFiles(dirHandle);

      setFiles(fileList);
      setCurrentIndex(0);
      setZoom(1);

      if (fileList.length > 0) {
        const url = await loadImageFile(fileList[0]);
        setImageUrl(url);
      }
    } catch (error) {
      console.error("选择文件夹失败:", error);
    }
  }, []);

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

  // 鼠标滚轮缩放
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
    },
    [zoomIn, zoomOut]
  );

  const state: ComicViewerState = {
    files,
    currentIndex,
    zoom,
    imageUrl,
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
      goToPage: (index: number) => {
        if (index >= 0 && index < files.length) {
          setCurrentIndex(index);
          loadImage(files[index]);
        }
      },
    },
  };
};
