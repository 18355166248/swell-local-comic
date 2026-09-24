import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type {
  ChapterSequenceItem,
  ComicFile,
  ComicViewerState,
  ViewMode,
  ReadingHistory,
} from "../types";
import {
  DEFAULT_SCROLL_RATIO,
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
  const [scrollTargetIndex, setScrollTargetIndex] = useState<number | null>(null);
  const scrollLoadRequestRef = useRef(0);
  const [scrollRatio, setScrollRatio] = useState<number>(DEFAULT_SCROLL_RATIO);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const isLoadingNextFolderRef = useRef(false);
  const hasNoMoreFoldersRef = useRef(false);
  const isLoadingRef = useRef(false);
  const currentImageUrlsRef = useRef<string[]>([]);
  const currentImageUrlRef = useRef<string>("");
  const preloadCacheRef = useRef<Map<string, string>>(new Map());
  const preloadWindowRef = useRef<Set<string>>(new Set());
  const imageLoadPromisesRef = useRef<Map<string, Promise<string>>>(new Map());
  const pageRequestRef = useRef(0);
  const pageRequestedPathRef = useRef("");
  const folderRequestRef = useRef(0);
  const [error, setError] = useState<string | null>(null);

  // 同步 ref，避免 loadNextFolder 依赖 isLoading state 导致级联重建
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const revokePageImageUrls = useCallback((preserveUrl = "") => {
    const cachedUrls = new Set(preloadCacheRef.current.values());
    cachedUrls.forEach((url) => {
      if (url !== preserveUrl && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    });
    preloadCacheRef.current.clear();
    preloadWindowRef.current.clear();

    if (
      currentImageUrlRef.current &&
      currentImageUrlRef.current !== preserveUrl &&
      !cachedUrls.has(currentImageUrlRef.current) &&
      currentImageUrlRef.current.startsWith("blob:")
    ) {
      URL.revokeObjectURL(currentImageUrlRef.current);
    }
    currentImageUrlRef.current = "";
    imageLoadPromisesRef.current.clear();
  }, []);

  /** 按文件路径去重加载，保证同一文件只有一个 blob URL，避免并发加载互相覆盖缓存 */
  const getOrLoadImageFile = useCallback((file: ComicFile): Promise<string> => {
    const inFlight = imageLoadPromisesRef.current.get(file.path);
    if (inFlight) return inFlight;

    const promise = loadImageFile(file).finally(() => {
      if (imageLoadPromisesRef.current.get(file.path) === promise) {
        imageLoadPromisesRef.current.delete(file.path);
      }
    });
    imageLoadPromisesRef.current.set(file.path, promise);
    return promise;
  }, []);

  const handleFolderSelect = useCallback(async () => {
    let requestId = 0;
    try {
      const directRestore = sessionStorage.getItem("directRestore");
      let restoreData: ReadingHistory | null = null;
      if (directRestore) {
        sessionStorage.removeItem("directRestore");
        restoreData = JSON.parse(directRestore) as ReadingHistory;
      }
      const pendingFolder = sessionStorage.getItem("openComicFolder");
      let folderInfo = restoreData
        ? { name: restoreData.folderName, path: restoreData.folderPath }
        : null;

      if (!folderInfo && pendingFolder) {
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
      requestId = ++folderRequestRef.current;
      setError(null);
      setIsLoading(true);
      setLoadingProgress(0);

      const fileList = await scanImageFiles(folderInfo.path);
      if (fileList.length === 0) throw new Error("目录中没有可阅读的图片");
      if (requestId !== folderRequestRef.current) return;

      if (!restoreData) {
        const restoreState = sessionStorage.getItem("restoreState");
        if (restoreState) {
          sessionStorage.removeItem("restoreState");
          restoreData = JSON.parse(restoreState) as ReadingHistory;
        }
      }

      const oldIndex = restoreData?.currentIndex ?? 0;
      const oldFile = restoreData?.files?.[oldIndex];
      const foundIndex = oldFile
        ? fileList.findIndex((file) => file.path === oldFile.path || file.name === oldFile.name)
        : -1;
      const correctIndex = foundIndex >= 0
        ? foundIndex
        : Math.max(0, Math.min(oldIndex, fileList.length - 1));
      const targetMode = restoreData?.viewMode ?? viewMode;
      let firstUrl = "";
      try {
        firstUrl = await getOrLoadImageFile(fileList[correctIndex]);
      } catch (loadError) {
        console.error("加载当前图片失败:", loadError);
        if (requestId === folderRequestRef.current && targetMode === "page") {
          setError("当前图片加载失败，可以点击画面重试或翻到下一页");
        }
      }
      if (requestId !== folderRequestRef.current) {
        if (firstUrl) URL.revokeObjectURL(firstUrl);
        return;
      }

      pageRequestRef.current++;
      revokeImageUrls(currentImageUrlsRef.current);
      currentImageUrlsRef.current = [];
      revokePageImageUrls(firstUrl);
      setImageUrls([]);
      setFiles(fileList);
      setFolderName(folderInfo.name);
      setFolderPath(folderInfo.path);
      sessionStorage.setItem("currentFolderPath", folderInfo.path);
      setCurrentIndex(correctIndex);
      setZoom(restoreData?.zoom ?? 1);
      setViewMode(targetMode);
      setImageWidth(restoreData?.imageWidth ?? imageWidth);
      setScrollRatio(restoreData?.scrollRatio ?? DEFAULT_SCROLL_RATIO);
      setScrollPosition(restoreData?.scrollPosition ?? 0);
      setScrollHeight(restoreData?.scrollHeight ?? 0);
      setScrollTargetIndex(null);
      currentImageUrlRef.current = firstUrl;
      if (firstUrl) preloadCacheRef.current.set(fileList[correctIndex].path, firstUrl);
      setImageUrl(firstUrl);
      isLoadingNextFolderRef.current = false;
      hasNoMoreFoldersRef.current = false;

      if (targetMode === "scroll") {
        const scrollLoadId = ++scrollLoadRequestRef.current;
        await loadImagesInBatches(fileList, (urls, progress) => {
          if (requestId !== folderRequestRef.current || scrollLoadId !== scrollLoadRequestRef.current) return;
          currentImageUrlsRef.current = urls;
          setImageUrls(urls);
          setLoadingProgress(progress);
        }, () => requestId !== folderRequestRef.current || scrollLoadId !== scrollLoadRequestRef.current);
      }
      if (requestId === folderRequestRef.current) setIsLoading(false);
    } catch (error) {
      console.error("选择文件夹失败:", error);
      if (requestId === 0 || requestId === folderRequestRef.current) {
        setError(error instanceof Error ? error.message : "无法打开目录，请重试");
        setIsLoading(false);
      }
    }
  }, [viewMode, imageWidth, revokePageImageUrls, getOrLoadImageFile]);

  const loadImage = useCallback(async (file: ComicFile) => {
    const requestId = ++pageRequestRef.current;
    pageRequestedPathRef.current = file.path;
    setError(null);
    try {
      const cached = preloadCacheRef.current.get(file.path);
      if (cached) {
        if (requestId !== pageRequestRef.current) return; // 已有更新的翻页请求，丢弃过期结果
        const cachedUrls = new Set(preloadCacheRef.current.values());
        if (
          currentImageUrlRef.current &&
          currentImageUrlRef.current !== cached &&
          !cachedUrls.has(currentImageUrlRef.current)
        ) {
          URL.revokeObjectURL(currentImageUrlRef.current);
        }
        currentImageUrlRef.current = cached;
        setImageUrl(cached);
        return;
      }

      setImageUrl("");
      const url = await getOrLoadImageFile(file);
      if (requestId !== pageRequestRef.current) {
        if (file.path !== pageRequestedPathRef.current && ![...preloadCacheRef.current.values()].includes(url)) {
          URL.revokeObjectURL(url);
        }
        return;
      }
      preloadCacheRef.current.set(file.path, url);
      const cachedUrls = new Set(preloadCacheRef.current.values());
      if (
        currentImageUrlRef.current &&
        currentImageUrlRef.current !== url &&
        !cachedUrls.has(currentImageUrlRef.current)
      ) {
        URL.revokeObjectURL(currentImageUrlRef.current);
      }
      currentImageUrlRef.current = url;
      setImageUrl(url);
    } catch (error) {
      console.error("加载图片失败:", error);
      if (requestId === pageRequestRef.current) {
        setImageUrl("");
        setError("当前图片加载失败，可以点击画面重试或翻到下一页");
      }
    }
  }, [getOrLoadImageFile]);

  /** 滚动/分页模式下加载同级下一文件夹：先清空当前列表，再加载下一文件夹，显示 loading */
  const loadNextFolder = useCallback(
    async (fromEmptyFolder = false) => {
      const isScrollMode = viewMode === "scroll";
      const isPageMode = viewMode === "page";
      if (
        (!isScrollMode && !isPageMode) ||
        (!fromEmptyFolder && isLoadingRef.current) ||
        isLoadingNextFolderRef.current ||
        hasNoMoreFoldersRef.current
      ) {
        return;
      }

      const currentFolderPath = sessionStorage.getItem("currentFolderPath");
      if (!currentFolderPath) return;

      let nextFolder = null;
      let sequence: ChapterSequenceItem[] | null = null;
      const chapterSequence = sessionStorage.getItem("comicChapterSequence");

      if (chapterSequence) {
        try {
          sequence = JSON.parse(chapterSequence) as ChapterSequenceItem[];
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
      const requestId = ++folderRequestRef.current;
      setIsLoading(true);
      setLoadingProgress(0);
      setError(null);

      try {
        let newFiles: ComicFile[] = [];
        while (nextFolder && newFiles.length === 0) {
          newFiles = await scanImageFiles(nextFolder.path);
          if (newFiles.length > 0) break;
          if (sequence) {
            const index = sequence.findIndex((item) =>
              normalizeLibraryPathId(item.path) === normalizeLibraryPathId(nextFolder!.path),
            );
            nextFolder = index >= 0 ? sequence[index + 1] ?? null : null;
          } else {
            nextFolder = await getNextSiblingFolder(nextFolder.path);
          }
        }
        if (!nextFolder) {
          hasNoMoreFoldersRef.current = true;
          throw new Error("后续章节没有可阅读的图片");
        }
        if (requestId !== folderRequestRef.current) return;

        const sortedNewFiles = sortFiles(newFiles);
        let firstUrl = "";
        if (isPageMode) firstUrl = await getOrLoadImageFile(sortedNewFiles[0]);
        if (requestId !== folderRequestRef.current) {
          if (firstUrl) URL.revokeObjectURL(firstUrl);
          return;
        }

        pageRequestRef.current++;
        revokeImageUrls(currentImageUrlsRef.current);
        currentImageUrlsRef.current = [];
        revokePageImageUrls(firstUrl);
        setImageUrls([]);
        setCurrentIndex(0);
        setScrollPosition(0);
        setScrollHeight(0);
        setScrollTargetIndex(null);
        setFolderName(nextFolder.name);
        setFolderPath(nextFolder.path);
        sessionStorage.setItem("currentFolderPath", nextFolder.path);
        setFiles(sortedNewFiles);

        if (isPageMode) {
          currentImageUrlRef.current = firstUrl;
          preloadCacheRef.current.set(sortedNewFiles[0].path, firstUrl);
          setImageUrl(firstUrl);
          setLoadingProgress(100);
        } else {
          setImageUrl("");
          const scrollLoadId = ++scrollLoadRequestRef.current;
          await loadImagesInBatches(sortedNewFiles, (urls, progress) => {
            if (requestId !== folderRequestRef.current || scrollLoadId !== scrollLoadRequestRef.current) return;
            currentImageUrlsRef.current = urls;
            setImageUrls(urls);
            setLoadingProgress(progress);
          }, () => requestId !== folderRequestRef.current || scrollLoadId !== scrollLoadRequestRef.current);
        }
      } catch (error) {
        console.error("加载下一文件夹失败:", error);
        if (requestId === folderRequestRef.current) {
          setError(error instanceof Error ? error.message : "无法加载下一章节");
        }
      } finally {
        if (requestId === folderRequestRef.current) setIsLoading(false);
        if (requestId === folderRequestRef.current) isLoadingNextFolderRef.current = false;
      }
    },
    [viewMode, revokePageImageUrls, getOrLoadImageFile]
  );

  useEffect(() => {
    return () => {
      revokeImageUrls(currentImageUrlsRef.current);
      revokePageImageUrls();
    };
  }, [revokePageImageUrls]);

  /** 后台预加载相邻图片（距离当前页 ±2），翻页瞬间无闪烁 */
  const preloadAdjacent = useCallback(
    (baseIndex: number) => {
      if (viewMode !== "page" || files.length === 0) return;
      const start = Math.max(0, baseIndex - 2);
      const end = Math.min(files.length, baseIndex + 3);
      preloadWindowRef.current = new Set(files.slice(start, end).map((file) => file.path));
      for (const [path, url] of preloadCacheRef.current) {
        if (!preloadWindowRef.current.has(path)) {
          preloadCacheRef.current.delete(path);
          if (url !== currentImageUrlRef.current) URL.revokeObjectURL(url);
        }
      }
      const folderRequestId = folderRequestRef.current;
      for (let i = start; i < end; i++) {
        if (i === baseIndex) continue;
        const file = files[i];
        if (!preloadCacheRef.current.has(file.path)) {
          getOrLoadImageFile(file).then((url) => {
            if (folderRequestId !== folderRequestRef.current || !preloadWindowRef.current.has(file.path)) {
              if (file.path !== pageRequestedPathRef.current && url !== currentImageUrlRef.current && ![...preloadCacheRef.current.values()].includes(url)) {
                URL.revokeObjectURL(url);
              }
              return;
            }
            preloadCacheRef.current.set(file.path, url);
          }).catch(() => { /* 静默失败，翻页时重新加载 */ });
        }
      }
    },
    [files, viewMode, getOrLoadImageFile],
  );

  const nextPage = useCallback(async () => {
    if (currentIndex < files.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      await loadImage(files[newIndex]);
      preloadAdjacent(newIndex);
    } else if (viewMode === "page" && currentIndex === files.length - 1 && files.length > 0) {
      await loadNextFolder();
    }
  }, [currentIndex, files, loadImage, viewMode, loadNextFolder, preloadAdjacent]);

  const prevPage = useCallback(async () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      await loadImage(files[newIndex]);
      preloadAdjacent(newIndex);
    }
  }, [currentIndex, files, loadImage, preloadAdjacent]);

  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev * 1.2, 3));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev / 1.2, 0.5));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  // 切换视图模式
  const toggleViewMode = useCallback(async () => {
    const newMode: ViewMode = viewMode === "page" ? "scroll" : "page";
    setViewMode(newMode);

    if (newMode === "page") {
      scrollLoadRequestRef.current++;
      revokeImageUrls(currentImageUrlsRef.current);
      currentImageUrlsRef.current = [];
      setImageUrls([]);
      setScrollTargetIndex(null);
      setIsLoading(false);
      if (files[currentIndex]) await loadImage(files[currentIndex]);
      return;
    }

    if (newMode === "scroll" && files.length > 0) {
      const requestId = folderRequestRef.current;
      const scrollLoadId = ++scrollLoadRequestRef.current;
      setScrollTargetIndex(currentIndex);
      setScrollPosition(0);
      setScrollHeight(0);
      setIsLoading(true);
      setLoadingProgress(0);
      await loadImagesInBatches(files, (urls, progress) => {
        if (requestId !== folderRequestRef.current || scrollLoadId !== scrollLoadRequestRef.current) return;
        currentImageUrlsRef.current = urls;
        setImageUrls(urls);
        setLoadingProgress(progress);
      }, () => requestId !== folderRequestRef.current || scrollLoadId !== scrollLoadRequestRef.current);
      if (requestId === folderRequestRef.current && scrollLoadId === scrollLoadRequestRef.current) setIsLoading(false);
    }
  }, [viewMode, files, currentIndex, loadImage]);

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
    if (folderName && folderPath && files.length > 0) {
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
    folderPath,
    files,
    currentIndex,
    zoom,
    viewMode,
    imageWidth,
    scrollRatio,
    scrollPosition,
    scrollHeight,
  ]);

  const setScrollRatioWrapped = useCallback(
    (ratio: number) => setScrollRatio(Math.max(0.1, Math.min(1.0, ratio))),
    [],
  );

  const goToPage = useCallback(
    (index: number) => {
      if (index >= 0 && index < files.length) {
        setCurrentIndex(index);
        void loadImage(files[index]).then(() => preloadAdjacent(index));
      }
    },
    [files, loadImage, preloadAdjacent],
  );

  const onScrollPositionChange = useCallback(
    (position: number, height: number) => {
      setScrollPosition(position);
      setScrollHeight(height);
    },
    [],
  );

  const onCurrentImageChange = useCallback(
    (index: number) => {
      if (viewMode === "scroll") {
        setCurrentIndex(index);
      }
    },
    [viewMode],
  );

  const retryImage = useCallback(async (index: number) => {
    const file = files[index];
    if (!file) return;
    if (viewMode === "page") {
      const cached = preloadCacheRef.current.get(file.path);
      preloadCacheRef.current.delete(file.path);
      if (cached && cached !== currentImageUrlRef.current) URL.revokeObjectURL(cached);
      await loadImage(file);
      return;
    }
    const requestId = folderRequestRef.current;
    try {
      const url = await loadImageFile(file);
      if (requestId !== folderRequestRef.current) {
        URL.revokeObjectURL(url);
        return;
      }
      const previous = currentImageUrlsRef.current[index];
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
      const nextUrls = [...currentImageUrlsRef.current];
      nextUrls[index] = url;
      currentImageUrlsRef.current = nextUrls;
      setImageUrls(nextUrls);
      setError(null);
    } catch (retryError) {
      console.error("重试加载图片失败:", retryError);
      setError("图片仍无法加载，请检查原文件");
    }
  }, [files, viewMode, loadImage]);

  const loadNextFolderAction = useCallback(() => {
    loadNextFolder();
  }, [loadNextFolder]);

  const actions = useMemo(() => ({
    handleFolderSelect,
    nextPage,
    prevPage,
    zoomIn,
    zoomOut,
    resetZoom,
    handleWheel,
    toggleViewMode,
    setImageWidth: setImageWidthValue,
    setScrollRatio: setScrollRatioWrapped,
    goToPage,
    onScrollPositionChange,
    onCurrentImageChange,
    retryImage,
    loadNextFolder: loadNextFolderAction,
  }), [
    handleFolderSelect, nextPage, prevPage, zoomIn, zoomOut, resetZoom,
    handleWheel, toggleViewMode, setImageWidthValue, setScrollRatioWrapped,
    goToPage, onScrollPositionChange, onCurrentImageChange, retryImage, loadNextFolderAction,
  ]);

  const state = useMemo<ComicViewerState>(() => ({
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
    scrollTargetIndex,
    scrollRatio,
    isLoading,
    loadingProgress,
    error,
  }), [
    files, currentIndex, zoom, imageUrl, viewMode, imageWidth, imageUrls,
    folderName, folderPath, scrollPosition, scrollHeight, scrollTargetIndex, scrollRatio,
    isLoading, loadingProgress, error,
  ]);

  return { state, actions };
};
