import { useState, useCallback, useEffect, useRef } from "react";
import type {
  ComicFile,
  ComicViewerState,
  ViewMode,
  ReadingHistory,
} from "../types";
import {
  selectFolder,
  scanImageFiles,
  loadImageFile,
  loadImagesInBatches,
  revokeImageUrls,
  sortFiles,
  getNextSiblingFolder,
} from "../utils/fileUtils";
import { saveHistory } from "../utils/historyUtils";
import { normalizeLibraryPathId } from "../utils/libraryUtils";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

interface ChapterSequenceItem {
  name: string;
  path: string;
}

export const useComicViewer = () => {
  const [files, setFiles] = useState<ComicFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("scroll");
  const [imageWidth, setImageWidth] = useState<number>(600);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [folderName, setFolderName] = useState<string>("");
  const [folderPath, setFolderPath] = useState<string>("");
  const [scrollPosition, setScrollPosition] = useState<number>(0);
  const [scrollHeight, setScrollHeight] = useState<number>(0);
  const [scrollRatio, setScrollRatio] = useState<number>(0.94);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const isLoadingNextFolderRef = useRef(false);
  const hasNoMoreFoldersRef = useRef(false);
  const currentImageUrlsRef = useRef<string[]>([]);
  const currentImageUrlRef = useRef<string>("");

  const handleFolderSelect = useCallback(async () => {
    try {
      // 在加载新文件夹前 revoke 旧的 blob URL
      revokeImageUrls(currentImageUrlsRef.current);
      currentImageUrlsRef.current = [];
      if (currentImageUrlRef.current) {
        URL.revokeObjectURL(currentImageUrlRef.current);
        currentImageUrlRef.current = "";
      }

      // 检查是否有直接恢复的历史记录
      const directRestore = sessionStorage.getItem("directRestore");
      if (directRestore) {
        try {
          const history: ReadingHistory = JSON.parse(directRestore);
          sessionStorage.removeItem("directRestore");

          // 直接使用历史记录中的文件列表，并进行排序
          const sortedFiles = sortFiles(history.files);
          setFiles(sortedFiles);
          setFolderName(history.folderName);
          setFolderPath(history.folderPath);
          sessionStorage.setItem("currentFolderPath", history.folderPath);

          isLoadingNextFolderRef.current = false;
          hasNoMoreFoldersRef.current = false;

          // 恢复阅读状态
          const targetIndex = history.currentIndex || 0;
          const targetZoom = history.zoom || 1;
          const targetViewMode = history.viewMode || viewMode;
          const targetImageWidth = history.imageWidth || imageWidth;
          const targetScrollRatio = history.scrollRatio ?? 0.94;
          const targetScrollPosition = history.scrollPosition || 0;
          const targetScrollHeight = history.scrollHeight || 0;

          setZoom(targetZoom);
          setViewMode(targetViewMode);
          setImageWidth(targetImageWidth);
          setScrollRatio(targetScrollRatio);
          console.log(
            "[useComicViewer] 恢复滚动位置 - position:",
            targetScrollPosition,
            "height:",
            targetScrollHeight,
          );
          setScrollPosition(targetScrollPosition);
          setScrollHeight(targetScrollHeight);

          if (sortedFiles.length > 0) {
            // 由于文件可能被重新排序，需要找到正确的索引
            // 如果历史记录中的文件名在当前排序后的列表中，使用排序后的索引
            const historyFileName = history.files[targetIndex]?.name;
            let correctIndex = targetIndex;
            if (historyFileName) {
              const foundIndex = sortedFiles.findIndex(
                (f) => f.name === historyFileName,
              );
              if (foundIndex !== -1) {
                correctIndex = foundIndex;
              }
            }

            setCurrentIndex(correctIndex);
            const url = await loadImageFile(sortedFiles[correctIndex]);
            setImageUrl(url);

            // 如果是滚动模式，基于排序后的文件重新生成图片URLs
            if (targetViewMode === "scroll") {
              setIsLoading(true);
              setLoadingProgress(0);
              loadImagesInBatches(sortedFiles, (urls, progress) => {
                currentImageUrlsRef.current = urls;
                setImageUrls(urls);
                setLoadingProgress(progress);
              }).then(() => {
                setIsLoading(false);
              });
            }
          }

          return;
        } catch (error) {
          console.error("直接恢复历史记录失败:", error);
          sessionStorage.removeItem("directRestore");
        }
      }

      isLoadingNextFolderRef.current = false;
      hasNoMoreFoldersRef.current = false;

      const pendingFolder = sessionStorage.getItem("openComicFolder");
      let folderInfo = null;

      if (pendingFolder) {
        try {
          folderInfo = JSON.parse(pendingFolder);
          sessionStorage.removeItem("openComicFolder");
        } catch (error) {
          console.error("解析待打开文件夹失败:", error);
          sessionStorage.removeItem("openComicFolder");
        }
      }

      if (!folderInfo) {
        folderInfo = await selectFolder();
      }
      if (!folderInfo) return;

      isLoadingNextFolderRef.current = false;
      hasNoMoreFoldersRef.current = false;

      const fileList = await scanImageFiles(folderInfo.path);

      setFiles(fileList);
      setFolderName(folderInfo.name);
      setFolderPath(folderInfo.path);
      // 保存文件夹路径到sessionStorage，用于历史记录
      sessionStorage.setItem("currentFolderPath", folderInfo.path);

      // 检查是否有需要恢复的状态
      const restoreState = sessionStorage.getItem("restoreState");
      let restoreData: ReadingHistory | null = null;

      if (restoreState) {
        try {
          restoreData = JSON.parse(restoreState);
          sessionStorage.removeItem("restoreState");
        } catch (error) {
          console.error("解析恢复状态失败:", error);
        }
      }

      // 恢复或设置默认状态
      const targetIndex = restoreData?.currentIndex || 0;
      const targetZoom = restoreData?.zoom || 1;
      const targetViewMode = restoreData?.viewMode || viewMode;
      const targetImageWidth = restoreData?.imageWidth || imageWidth;
      const targetScrollRatio = restoreData?.scrollRatio ?? 0.94;

      setZoom(targetZoom);
      setViewMode(targetViewMode);
      setImageWidth(targetImageWidth);
      setScrollRatio(targetScrollRatio);

      if (fileList.length > 0) {
        // 如果是从历史记录恢复，需要找到正确的索引
        // 因为文件列表可能已经被重新排序
        let correctIndex = targetIndex;
        if (restoreData?.files && restoreData.files.length > targetIndex) {
          const historyFileName = restoreData.files[targetIndex]?.name;
          if (historyFileName) {
            const foundIndex = fileList.findIndex(
              (f) => f.name === historyFileName,
            );
            if (foundIndex !== -1) {
              correctIndex = foundIndex;
            }
          }
        }

        setCurrentIndex(correctIndex);
        const url = await loadImageFile(fileList[correctIndex]);
        setImageUrl(url);

        // 如果是滚动模式，分批加载所有图片
        if (targetViewMode === "scroll") {
          setIsLoading(true);
          setLoadingProgress(0);
          loadImagesInBatches(fileList, (urls, progress) => {
            currentImageUrlsRef.current = urls;
            setImageUrls(urls);
            setLoadingProgress(progress);
          }).then(() => {
            setIsLoading(false);
          });
        }
      }
    } catch (error) {
      console.error("选择文件夹失败:", error);
    }
  }, [viewMode, imageWidth]);

  const loadImage = useCallback(async (file: ComicFile) => {
    try {
      if (currentImageUrlRef.current) {
        URL.revokeObjectURL(currentImageUrlRef.current);
      }
      const url = await loadImageFile(file);
      currentImageUrlRef.current = url;
      setImageUrl(url);
    } catch (error) {
      console.error("加载图片失败:", error);
    }
  }, []);

  /** 滚动/分页模式下加载同级下一文件夹：先清空当前列表，再加载下一文件夹，显示 loading */
  const loadNextFolder = useCallback(
    async (fromEmptyFolder = false) => {
      const isScrollMode = viewMode === "scroll";
      const isPageMode = viewMode === "page";
      if (
        (!isScrollMode && !isPageMode) ||
        (!fromEmptyFolder && isLoading) ||
        isLoadingNextFolderRef.current ||
        hasNoMoreFoldersRef.current
      ) {
        return;
      }

      const currentFolderPath = sessionStorage.getItem("currentFolderPath");
      if (!currentFolderPath) return;

      let nextFolder = null;
      const chapterSequence = sessionStorage.getItem("comicChapterSequence");

      if (chapterSequence) {
        try {
          const sequence: ChapterSequenceItem[] = JSON.parse(chapterSequence);
          const currentSequenceIndex = sequence.findIndex(
            (item) =>
              normalizeLibraryPathId(item.path) ===
              normalizeLibraryPathId(currentFolderPath)
          );
          if (
            currentSequenceIndex >= 0 &&
            currentSequenceIndex < sequence.length - 1
          ) {
            nextFolder = sequence[currentSequenceIndex + 1];
          } else if (currentSequenceIndex === sequence.length - 1) {
            hasNoMoreFoldersRef.current = true;
            return;
          }
        } catch (error) {
          console.error("解析章节序列失败:", error);
          sessionStorage.removeItem("comicChapterSequence");
        }
      }

      if (!nextFolder) {
        nextFolder = await getNextSiblingFolder(currentFolderPath);
      }
      if (!nextFolder) {
        hasNoMoreFoldersRef.current = true;
        return;
      }

      isLoadingNextFolderRef.current = true;

      // 先 revoke 旧 blob URL，再清空当前图片列表
      revokeImageUrls(currentImageUrlsRef.current);
      currentImageUrlsRef.current = [];
      if (currentImageUrlRef.current) {
        URL.revokeObjectURL(currentImageUrlRef.current);
        currentImageUrlRef.current = "";
      }

      // 先清空当前图片列表并显示 loading
      setFiles([]);
      setImageUrls([]);
      setCurrentIndex(0);
      setScrollPosition(0);
      setScrollHeight(0);
      setFolderName(nextFolder.name);
      setFolderPath(nextFolder.path);
      sessionStorage.setItem("currentFolderPath", nextFolder.path);
      setIsLoading(true);
      setLoadingProgress(0);

      try {
        const newFiles = await scanImageFiles(nextFolder.path);
        if (newFiles.length === 0) {
          // 空文件夹：保持 loading，递归尝试下一文件夹（await 避免父级 finally 提前关闭 loading）
          isLoadingNextFolderRef.current = false;
          await loadNextFolder(true);
          return;
        }

        const sortedNewFiles = sortFiles(newFiles);
        setFiles(sortedNewFiles);

        if (isPageMode) {
          // 分页模式：只加载第一张图片
          const url = await loadImageFile(sortedNewFiles[0]);
          setImageUrl(url);
          setLoadingProgress(100);
        } else {
          // 滚动模式：分批加载所有图片
          await loadImagesInBatches(sortedNewFiles, (urls, progress) => {
            currentImageUrlsRef.current = urls;
            setImageUrls(urls);
            setLoadingProgress(progress);
          });
        }
      } catch (error) {
        console.error("加载下一文件夹失败:", error);
      } finally {
        setIsLoading(false);
        isLoadingNextFolderRef.current = false;
      }
    },
    [viewMode, isLoading]
  );

  const nextPage = useCallback(async () => {
    if (currentIndex < files.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      await loadImage(files[newIndex]);
    } else if (viewMode === "page" && currentIndex === files.length - 1 && files.length > 0) {
      // 分页模式下翻到最后一页再翻页时，加载下一文件夹
      await loadNextFolder();
    }
  }, [currentIndex, files, loadImage, viewMode, loadNextFolder]);

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

  // 键盘快捷键（←/A/D/空格/+/-/0，滚动模式的 W/S/↑/↓ 由 useScrollKeyboard 处理）
  useKeyboardShortcuts({
    viewMode,
    onNextPage: nextPage,
    onPrevPage: prevPage,
    onLoadNextFolder: loadNextFolder,
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    onResetZoom: resetZoom,
  });

  // 切换视图模式
  const toggleViewMode = useCallback(async () => {
    const newMode: ViewMode = viewMode === "page" ? "scroll" : "page";
    setViewMode(newMode);

    // 切换到滚动模式时，分批加载所有图片
    if (newMode === "scroll" && files.length > 0) {
      setIsLoading(true);
      setLoadingProgress(0);
      await loadImagesInBatches(files, (urls, progress) => {
        currentImageUrlsRef.current = urls;
        setImageUrls(urls);
        setLoadingProgress(progress);
      });
      setIsLoading(false);
    }
  }, [viewMode, files]);

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
    [viewMode, zoomIn, zoomOut],
  );

  // 保存阅读历史记录
  useEffect(() => {
    if (folderName && files.length > 0) {
      // 获取文件夹路径（从sessionStorage或通过其他方式获取）
      const folderPath = sessionStorage.getItem("currentFolderPath") || "";

      saveHistory({
        folderName,
        folderPath,
        files,
        currentIndex,
        totalFiles: files.length,
        currentFileName: files[currentIndex]?.name,
        zoom,
        viewMode,
        imageWidth,
        scrollRatio,
        scrollPosition: viewMode === "scroll" ? scrollPosition : undefined,
        scrollHeight: viewMode === "scroll" ? scrollHeight : undefined,
      });
    }
  }, [
    folderName,
    files,
    currentIndex,
    zoom,
    viewMode,
    imageWidth,
    scrollRatio,
    scrollPosition,
    scrollHeight,
  ]);

  const state: ComicViewerState = {
    files,
    currentIndex,
    zoom,
    imageUrl,
    viewMode,
    imageWidth,
    imageUrls,
    folderName,
    folderPath,
    scrollPosition,
    scrollHeight,
    scrollRatio,
    isLoading,
    loadingProgress,
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
      setScrollRatio: (ratio: number) => setScrollRatio(Math.max(0.1, Math.min(1.0, ratio))),
      goToPage: (index: number) => {
        if (index >= 0 && index < files.length) {
          setCurrentIndex(index);
          loadImage(files[index]);
        }
      },
      onScrollPositionChange: (position: number, height: number) => {
        // 简化：直接更新位置和高度，不做复杂判断
        setScrollPosition(position);
        setScrollHeight(height);
      },
      onCurrentImageChange: (index: number) => {
        // 滚动模式下更新当前图片索引
        if (viewMode === "scroll") {
          setCurrentIndex(index);
        }
      },
      loadNextFolder: () => {
        loadNextFolder();
      },
    },
  };
};
