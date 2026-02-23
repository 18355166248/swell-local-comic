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
  sortFiles,
  getNextSiblingFolder,
} from "../utils/fileUtils";
import { saveHistory } from "../utils/historyUtils";

export const useComicViewer = () => {
  const [files, setFiles] = useState<ComicFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("scroll");
  const [imageWidth, setImageWidth] = useState<number>(600);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [folderName, setFolderName] = useState<string>("");
  const [scrollPosition, setScrollPosition] = useState<number>(0);
  const [scrollHeight, setScrollHeight] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const isLoadingNextFolderRef = useRef(false);
  const hasNoMoreFoldersRef = useRef(false);

  const handleFolderSelect = useCallback(async () => {
    try {
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
          sessionStorage.setItem("currentFolderPath", history.folderPath);

          isLoadingNextFolderRef.current = false;
          hasNoMoreFoldersRef.current = false;

          // 恢复阅读状态
          const targetIndex = history.currentIndex || 0;
          const targetZoom = history.zoom || 1;
          const targetViewMode = history.viewMode || viewMode;
          const targetImageWidth = history.imageWidth || imageWidth;
          const targetScrollPosition = history.scrollPosition || 0;
          const targetScrollHeight = history.scrollHeight || 0;

          setZoom(targetZoom);
          setViewMode(targetViewMode);
          setImageWidth(targetImageWidth);
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
              // 分批加载所有图片
              const batchSize = 10;
              const loadImagesInBatches = async () => {
                setIsLoading(true);
                setLoadingProgress(0);
                const urls: string[] = [];
                for (let i = 0; i < sortedFiles.length; i += batchSize) {
                  const batch = sortedFiles.slice(i, i + batchSize);
                  const batchUrls = await Promise.all(
                    batch.map((file) => loadImageFile(file)),
                  );
                  urls.push(...batchUrls);
                  setImageUrls([...urls]);
                  const progress = Math.round(
                    ((i + batchSize) / sortedFiles.length) * 100,
                  );
                  setLoadingProgress(Math.min(progress, 100));
                  await new Promise((resolve) => {
                    if (typeof requestIdleCallback !== "undefined") {
                      requestIdleCallback(() => resolve(undefined), {
                        timeout: 100,
                      });
                    } else {
                      setTimeout(() => resolve(undefined), 0);
                    }
                  });
                }
                setIsLoading(false);
                setLoadingProgress(100);
              };
              loadImagesInBatches();
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

      const folderInfo = await selectFolder();
      if (!folderInfo) return;

      isLoadingNextFolderRef.current = false;
      hasNoMoreFoldersRef.current = false;

      const fileList = await scanImageFiles(folderInfo.path);

      setFiles(fileList);
      setFolderName(folderInfo.name);
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

      setZoom(targetZoom);
      setViewMode(targetViewMode);
      setImageWidth(targetImageWidth);

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
          // 分批加载图片，避免一次性加载导致卡死
          const batchSize = 10; // 每批加载10张图片
          const loadImagesInBatches = async () => {
            setIsLoading(true);
            setLoadingProgress(0);
            const urls: string[] = [];
            for (let i = 0; i < fileList.length; i += batchSize) {
              const batch = fileList.slice(i, i + batchSize);
              const batchUrls = await Promise.all(
                batch.map((file) => loadImageFile(file)),
              );
              urls.push(...batchUrls);
              // 每批加载后更新一次状态，让用户看到进度
              setImageUrls([...urls]);
              const progress = Math.round(
                ((i + batchSize) / fileList.length) * 100,
              );
              setLoadingProgress(Math.min(progress, 100));
              // 使用 requestIdleCallback 或 setTimeout 让浏览器有机会渲染
              await new Promise((resolve) => {
                if (typeof requestIdleCallback !== "undefined") {
                  requestIdleCallback(() => resolve(undefined), {
                    timeout: 100,
                  });
                } else {
                  setTimeout(() => resolve(undefined), 0);
                }
              });
            }
            setIsLoading(false);
            setLoadingProgress(100);
          };
          loadImagesInBatches();
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

  /** 滚动到底部时加载同级下一文件夹：先清空当前列表，再加载下一文件夹，显示 loading */
  const loadNextFolder = useCallback(
    async (fromEmptyFolder = false) => {
      if (
        viewMode !== "scroll" ||
        (!fromEmptyFolder && isLoading) ||
        isLoadingNextFolderRef.current ||
        hasNoMoreFoldersRef.current
      ) {
        return;
      }

      const currentFolderPath = sessionStorage.getItem("currentFolderPath");
      if (!currentFolderPath) return;

      const nextFolder = await getNextSiblingFolder(currentFolderPath);
      if (!nextFolder) {
        hasNoMoreFoldersRef.current = true;
        return;
      }

      isLoadingNextFolderRef.current = true;

      // 先清空当前图片列表并显示 loading
      setFiles([]);
      setImageUrls([]);
      setCurrentIndex(0);
      setScrollPosition(0);
      setScrollHeight(0);
      setFolderName(nextFolder.name);
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

        const batchSize = 10;
        const urls: string[] = [];

        for (let i = 0; i < sortedNewFiles.length; i += batchSize) {
          const batch = sortedNewFiles.slice(i, i + batchSize);
          const batchUrls = await Promise.all(
            batch.map((file) => loadImageFile(file))
          );
          urls.push(...batchUrls);
          setImageUrls([...urls]);
          const progress = Math.round(
            ((i + batchSize) / sortedNewFiles.length) * 100
          );
          setLoadingProgress(Math.min(progress, 100));
          await new Promise((resolve) => {
            if (typeof requestIdleCallback !== "undefined") {
              requestIdleCallback(() => resolve(undefined), { timeout: 50 });
            } else {
              setTimeout(() => resolve(undefined), 0);
            }
          });
        }

        setLoadingProgress(100);
      } catch (error) {
        console.error("加载下一文件夹失败:", error);
      } finally {
        setIsLoading(false);
        isLoadingNextFolderRef.current = false;
      }
    },
    [viewMode, isLoading]
  );

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
        case "a":
        case "A":
          if (viewMode === "page") {
            e.preventDefault();
            prevPage();
          }
          break;
        case "d":
        case "D":
          if (viewMode === "page") {
            e.preventDefault();
            nextPage();
          } else if (viewMode === "scroll") {
            e.preventDefault();
            loadNextFolder();
          }
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
    [nextPage, prevPage, zoomIn, zoomOut, resetZoom, viewMode, loadNextFolder],
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

    // 切换到滚动模式时，分批加载所有图片
    if (newMode === "scroll" && files.length > 0 && imageUrls.length === 0) {
      const batchSize = 10;
      setIsLoading(true);
      setLoadingProgress(0);
      const loadImagesInBatches = async () => {
        const urls: string[] = [];
        for (let i = 0; i < files.length; i += batchSize) {
          const batch = files.slice(i, i + batchSize);
          const batchUrls = await Promise.all(
            batch.map((file) => loadImageFile(file)),
          );
          urls.push(...batchUrls);
          setImageUrls([...urls]);
          const progress = Math.round(((i + batchSize) / files.length) * 100);
          setLoadingProgress(Math.min(progress, 100));
          await new Promise((resolve) => {
            if (typeof requestIdleCallback !== "undefined") {
              requestIdleCallback(() => resolve(undefined), { timeout: 100 });
            } else {
              setTimeout(() => resolve(undefined), 0);
            }
          });
        }
        setIsLoading(false);
        setLoadingProgress(100);
      };
      loadImagesInBatches();
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
    [viewMode, zoomIn, zoomOut],
  );

  // 视图模式切换时，分批加载所有图片
  useEffect(() => {
    if (viewMode === "scroll" && files.length > 0 && imageUrls.length === 0) {
      const batchSize = 10;
      const loadImagesInBatches = async () => {
        setIsLoading(true);
        setLoadingProgress(0);
        const urls: string[] = [];
        for (let i = 0; i < files.length; i += batchSize) {
          const batch = files.slice(i, i + batchSize);
          const batchUrls = await Promise.all(
            batch.map((file) => loadImageFile(file)),
          );
          urls.push(...batchUrls);
          setImageUrls([...urls]);
          const progress = Math.round(((i + batchSize) / files.length) * 100);
          setLoadingProgress(Math.min(progress, 100));
          await new Promise((resolve) => {
            if (typeof requestIdleCallback !== "undefined") {
              requestIdleCallback(() => resolve(undefined), { timeout: 100 });
            } else {
              setTimeout(() => resolve(undefined), 0);
            }
          });
        }
        setIsLoading(false);
        setLoadingProgress(100);
      };
      loadImagesInBatches();
    }
  }, [viewMode, files, imageUrls.length]);

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
        scrollPosition: viewMode === "scroll" ? scrollPosition : undefined,
        scrollHeight: viewMode === "scroll" ? scrollHeight : undefined,
        imageUrls: viewMode === "scroll" ? imageUrls : undefined,
      });
    }
  }, [
    folderName,
    files,
    currentIndex,
    zoom,
    viewMode,
    imageWidth,
    imageUrls,
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
    scrollPosition,
    scrollHeight,
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
