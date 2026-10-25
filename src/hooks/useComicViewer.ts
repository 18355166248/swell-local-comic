import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type {
  ChapterSequenceItem,
  ComicFile,
  ComicViewerState,
  FolderInfo,
  ViewMode,
  ReadingHistory,
} from "../types";
import {
  DEFAULT_SCROLL_RATIO,
  selectFolder,
  scanImageFiles,
  loadImageFile,
  sortFiles,
  getNextSiblingFolder,
  getPreviousSiblingFolder,
} from "../utils/fileUtils";
import { normalizeLibraryPathId } from "../utils/libraryUtils";
import { normalizeImagesPerGroup } from "../utils/readerUtils";
import { useReadingHistoryPersistence } from "./useReadingHistoryPersistence";
import { createReaderImageResources, createReaderResourceLifecycle, getReaderImageLoadOrder, StaleReaderImageRequest, type ReaderImageState, type ReaderImageSize } from "../utils/readerImageResources";

async function loadReaderImage(file: ComicFile) {
  const url = await loadImageFile(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { url, size: { width: image.naturalWidth, height: image.naturalHeight } };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export const useComicViewer = () => {
  const [files, setFiles] = useState<ComicFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("scroll");
  const [imageWidth, setImageWidth] = useState<number>(600);
  const [imagesPerGroup, setImagesPerGroup] = useState(1);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [scrollImageStates, setScrollImageStates] = useState<ReaderImageState[]>([]);
  const [scrollImageSizes, setScrollImageSizes] = useState<(ReaderImageSize | null)[]>([]);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [isScrollLayoutReady, setIsScrollLayoutReady] = useState(false);
  const [folderName, setFolderName] = useState<string>("");
  const [folderPath, setFolderPath] = useState<string>("");
  const [scrollPosition, setScrollPosition] = useState<number | undefined>(0);
  const [scrollHeight, setScrollHeight] = useState<number | undefined>(0);
  const [isRestoringScrollPosition, setIsRestoringScrollPosition] = useState(false);
  const isRestoringScrollPositionRef = useRef(false);
  const [scrollTargetIndex, setScrollTargetIndex] = useState<number | null>(null);
  const [scrollJumpRequest, setScrollJumpRequest] = useState(0);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const scrollLoadRequestRef = useRef(0);
  const [scrollRatio, setScrollRatio] = useState<number>(DEFAULT_SCROLL_RATIO);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const isLoadingNextFolderRef = useRef(false);
  const isLoadingPrevFolderRef = useRef(false);
  const hasNoMoreFoldersRef = useRef(false);
  const hasNoPreviousFoldersRef = useRef(false);
  const isLoadingRef = useRef(false);
  const imageResourcesRef = useRef<ReturnType<typeof createReaderImageResources> | null>(null);
  if (imageResourcesRef.current === null) {
    imageResourcesRef.current = createReaderImageResources(loadReaderImage, (url) => URL.revokeObjectURL(url));
  }
  const imageResources = imageResourcesRef.current;
  const resourceLifecycleRef = useRef<ReturnType<typeof createReaderResourceLifecycle> | null>(null);
  if (resourceLifecycleRef.current === null) resourceLifecycleRef.current = createReaderResourceLifecycle();
  const resourceLifecycle = resourceLifecycleRef.current;
  const activeViewModeRef = useRef<ViewMode>(viewMode);
  const pageRequestRef = useRef(0);
  const pageRequestedPathRef = useRef("");
  const folderRequestRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const { persistHistory, flushHistory } = useReadingHistoryPersistence({
    folderName, folderPath, files, currentIndex, zoom, viewMode,
    imageWidth, imagesPerGroup, scrollRatio, scrollPosition, scrollHeight, isLoading, isRestoringScrollPosition,
  }, isRestoringScrollPositionRef);

  const finishScrollRestoration = useCallback(() => {
    isRestoringScrollPositionRef.current = false;
    setIsRestoringScrollPosition(false);
  }, []);

  // 同步 ref，避免 loadNextFolder 依赖 isLoading state 导致级联重建
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const getOrLoadImageFile = useCallback(async (file: ComicFile) => (await imageResources.load(file)).url, [imageResources]);

  const clearScrollImages = useCallback(() => {
    setImageUrls([]);
    setScrollImageStates([]);
    setScrollImageSizes([]);
    setIsBackgroundLoading(false);
    setIsScrollLayoutReady(false);
  }, []);

  const publishScrollSnapshot = useCallback((fileList: ComicFile[]) => {
    const snapshot = imageResources.snapshot(fileList);
    setImageUrls(snapshot.urls);
    setScrollImageStates(snapshot.states);
    setScrollImageSizes(snapshot.sizes);
    const complete = snapshot.states.filter((state) => state === "ready" || state === "error").length;
    setLoadingProgress(Math.round(complete / fileList.length * 100));
    setIsBackgroundLoading(complete < fileList.length);
    setIsScrollLayoutReady(complete === fileList.length);
  }, [imageResources]);

  /** The target and its neighbors unlock the canvas; the remaining chapter loads quietly. */
  const loadScrollImages = useCallback(async (fileList: ComicFile[], targetIndex: number, folderRequestId: number) => {
    const requestId = ++scrollLoadRequestRef.current;
    const generation = imageResources.generation;
    const isCurrent = () => requestId === scrollLoadRequestRef.current && folderRequestId === folderRequestRef.current && generation === imageResources.generation && activeViewModeRef.current === "scroll";
    const publish = () => {
      if (!isCurrent()) return;
      publishScrollSnapshot(fileList);
    };
    const order = getReaderImageLoadOrder(fileList.length, targetIndex);
    const requests = order.map((index) => imageResources.load(fileList[index]).then(publish, publish));
    publish();
    await Promise.allSettled(requests.slice(0, 3));
    if (isCurrent()) {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
    void Promise.allSettled(requests).then(publish);
  }, [imageResources, publishScrollSnapshot]);

  const handleFolderSelect = useCallback(async () => {
    let requestId = 0;
    const folderIntentId = folderRequestRef.current;
    const previousGeneration = imageResources.generation;
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
      if (folderIntentId !== folderRequestRef.current) return;
      requestId = ++folderRequestRef.current;
      pageRequestRef.current++;
      scrollLoadRequestRef.current++;
      isLoadingRef.current = true;
      isLoadingNextFolderRef.current = false;
      isLoadingPrevFolderRef.current = false;
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
      imageResources.reset();
      let firstUrl = "";
      try {
        if (targetMode === "page") firstUrl = await getOrLoadImageFile(fileList[correctIndex]);
      } catch (loadError) {
        if (!(loadError instanceof StaleReaderImageRequest)) console.error("加载当前图片失败:", loadError);
        if (requestId === folderRequestRef.current && targetMode === "page") {
          setError("当前图片加载失败，可以点击画面重试或翻到下一页");
        }
      }
      if (requestId !== folderRequestRef.current) {
        return;
      }

      pageRequestRef.current++;
      setIsImageLoading(false);
      clearScrollImages();
      setFiles(fileList);
      setFolderName(folderInfo.name);
      setFolderPath(folderInfo.path);
      sessionStorage.setItem("currentFolderPath", folderInfo.path);
      setCurrentIndex(correctIndex);
      setZoom(restoreData?.zoom ?? 1);
      activeViewModeRef.current = targetMode;
      setViewMode(targetMode);
      setImageWidth(restoreData?.imageWidth ?? imageWidth);
      if (restoreData) setImagesPerGroup(normalizeImagesPerGroup(restoreData.imagesPerGroup));
      setScrollRatio(restoreData?.scrollRatio ?? DEFAULT_SCROLL_RATIO);
      setScrollPosition(targetMode === "scroll" && restoreData ? restoreData.scrollPosition : 0);
      setScrollHeight(targetMode === "scroll" && restoreData ? restoreData.scrollHeight : 0);
      const scrollRestoreTarget = targetMode === "scroll" && restoreData && restoreData.scrollPosition === undefined ? correctIndex : null;
      const restoringScrollPosition = targetMode === "scroll" && ((restoreData?.scrollPosition ?? 0) > 0 || (scrollRestoreTarget !== null && correctIndex > 0));
      isRestoringScrollPositionRef.current = restoringScrollPosition;
      setIsRestoringScrollPosition(restoringScrollPosition);
      setScrollTargetIndex(scrollRestoreTarget);
      setImageUrl(firstUrl);
      isLoadingNextFolderRef.current = false;
      isLoadingPrevFolderRef.current = false;
      hasNoMoreFoldersRef.current = false;
      hasNoPreviousFoldersRef.current = false;

      if (targetMode === "scroll") {
        await loadScrollImages(fileList, correctIndex, requestId);
      }
      if (requestId === folderRequestRef.current) setIsLoading(false);
    } catch (error) {
      console.error("选择文件夹失败:", error);
      if (requestId === 0 || requestId === folderRequestRef.current) {
        setError(error instanceof Error ? error.message : "无法打开目录，请重试");
        setIsLoading(false);
        if (requestId !== 0 && previousGeneration === imageResources.generation && activeViewModeRef.current === "scroll" && files.length > 0) {
          void loadScrollImages(files, currentIndex, requestId);
        }
      }
    }
  }, [viewMode, imageWidth, files, currentIndex, imageResources, clearScrollImages, loadScrollImages, getOrLoadImageFile]);

  const loadImage = useCallback(async (file: ComicFile) => {
    const requestId = ++pageRequestRef.current;
    const generation = imageResources.generation;
    const isCurrent = () => requestId === pageRequestRef.current && generation === imageResources.generation && activeViewModeRef.current === "page";
    pageRequestedPathRef.current = file.path;
    setError(null);
    try {
      const cached = imageResources.get(file.path)?.url;
      if (cached) {
        if (!isCurrent()) return;
        setImageUrl(cached);
        return;
      }

      setImageUrl("");
      setIsImageLoading(true);
      const url = await getOrLoadImageFile(file);
      if (!isCurrent()) return;
      setImageUrl(url);
    } catch (error) {
      if (!(error instanceof StaleReaderImageRequest)) console.error("加载图片失败:", error);
      if (isCurrent()) {
        setImageUrl("");
        setError("当前图片加载失败，可以点击画面重试或翻到下一页");
      }
    } finally {
      if (isCurrent()) setIsImageLoading(false);
    }
  }, [getOrLoadImageFile, imageResources]);

  /** 滚动/分页模式下加载同级下一文件夹：先清空当前列表，再加载下一文件夹，显示 loading */
  const loadNextFolder = useCallback(
    async (fromEmptyFolder = false) => {
      const isScrollMode = viewMode === "scroll";
      const isPageMode = viewMode === "page";
      if (
        (!isScrollMode && !isPageMode) ||
        (!fromEmptyFolder && isLoadingRef.current) ||
        isLoadingNextFolderRef.current ||
        isLoadingPrevFolderRef.current ||
        hasNoMoreFoldersRef.current
      ) {
        return;
      }

      const currentFolderPath = sessionStorage.getItem("currentFolderPath");
      if (!currentFolderPath) return;
      const lookupRequestId = folderRequestRef.current;
      isLoadingNextFolderRef.current = true;

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
            isLoadingNextFolderRef.current = false;
            return;
          }
        } catch (error) {
          console.error("解析章节序列失败:", error);
          sessionStorage.removeItem("comicChapterSequence");
          sequence = null;
        }
      }

      if (!nextFolder) {
        nextFolder = await getNextSiblingFolder(currentFolderPath);
      }
      if (lookupRequestId !== folderRequestRef.current) return;
      if (!nextFolder) {
        hasNoMoreFoldersRef.current = true;
        isLoadingNextFolderRef.current = false;
        return;
      }

      const requestId = ++folderRequestRef.current;
      const previousGeneration = imageResources.generation;
      pageRequestRef.current++;
      scrollLoadRequestRef.current++;
      isLoadingRef.current = true;
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
        imageResources.reset();
        let firstUrl = "";
        if (isPageMode) {
          try {
            firstUrl = await getOrLoadImageFile(sortedNewFiles[0]);
          } catch (error) {
            if (!(error instanceof StaleReaderImageRequest) && requestId === folderRequestRef.current) setError("当前图片加载失败，可以点击画面重试或翻到下一页");
          }
        }
        if (requestId !== folderRequestRef.current) {
          return;
        }

        pageRequestRef.current++;
        setIsImageLoading(false);
        clearScrollImages();
        setCurrentIndex(0);
        setScrollPosition(0);
        setScrollHeight(0);
        finishScrollRestoration();
        setScrollTargetIndex(null);
        setFolderName(nextFolder.name);
        setFolderPath(nextFolder.path);
        sessionStorage.setItem("currentFolderPath", nextFolder.path);
        setFiles(sortedNewFiles);
        hasNoPreviousFoldersRef.current = false;

        if (isPageMode) {
          setImageUrl(firstUrl);
          setLoadingProgress(100);
        } else {
          setImageUrl("");
          await loadScrollImages(sortedNewFiles, 0, requestId);
        }
      } catch (error) {
        console.error("加载下一文件夹失败:", error);
        if (requestId === folderRequestRef.current) {
          setError(error instanceof Error ? error.message : "无法加载下一章节");
          if (previousGeneration === imageResources.generation && isScrollMode && files.length > 0) {
            void loadScrollImages(files, currentIndex, requestId);
          }
        }
      } finally {
        if (requestId === folderRequestRef.current) setIsLoading(false);
        if (requestId === folderRequestRef.current) isLoadingNextFolderRef.current = false;
      }
    },
    [viewMode, files, currentIndex, imageResources, clearScrollImages, loadScrollImages, getOrLoadImageFile, finishScrollRestoration]
  );

  /**
   * 分页模式下加载同级上一文件夹：定位到该文件夹的最后一张图片，
   * 使「翻到章节第一张后继续上一页」可以跨章节衔接阅读。
   */
  const loadPreviousFolder = useCallback(
    async () => {
      if (
        viewMode !== "page" ||
        isLoadingRef.current ||
        isLoadingNextFolderRef.current ||
        isLoadingPrevFolderRef.current ||
        hasNoPreviousFoldersRef.current
      ) {
        return;
      }

      const currentFolderPath = sessionStorage.getItem("currentFolderPath");
      if (!currentFolderPath) return;
      const lookupRequestId = folderRequestRef.current;
      isLoadingPrevFolderRef.current = true;

      let prevFolder: FolderInfo | null = null;
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
          if (currentSequenceIndex > 0) {
            prevFolder = sequence[currentSequenceIndex - 1];
          } else if (currentSequenceIndex === 0) {
            hasNoPreviousFoldersRef.current = true;
            isLoadingPrevFolderRef.current = false;
            return;
          }
        } catch (error) {
          console.error("解析章节序列失败:", error);
          sessionStorage.removeItem("comicChapterSequence");
          sequence = null;
        }
      }

      if (!prevFolder) {
        prevFolder = await getPreviousSiblingFolder(currentFolderPath);
      }
      if (lookupRequestId !== folderRequestRef.current) return;
      if (!prevFolder) {
        hasNoPreviousFoldersRef.current = true;
        isLoadingPrevFolderRef.current = false;
        return;
      }

      const requestId = ++folderRequestRef.current;
      pageRequestRef.current++;
      scrollLoadRequestRef.current++;
      isLoadingRef.current = true;
      setIsLoading(true);
      setLoadingProgress(0);
      setError(null);

      try {
        let newFiles: ComicFile[] = [];
        while (prevFolder && newFiles.length === 0) {
          newFiles = await scanImageFiles(prevFolder.path);
          if (newFiles.length > 0) break;
          if (sequence) {
            const index = sequence.findIndex(
              (item) =>
                normalizeLibraryPathId(item.path) ===
                normalizeLibraryPathId(prevFolder!.path)
            );
            prevFolder = index > 0 ? sequence[index - 1] : null;
          } else {
            prevFolder = await getPreviousSiblingFolder(prevFolder.path);
          }
        }
        if (!prevFolder) {
          hasNoPreviousFoldersRef.current = true;
          throw new Error("前面没有可阅读的章节");
        }
        if (requestId !== folderRequestRef.current) return;

        const sortedNewFiles = sortFiles(newFiles);
        const lastIndex = sortedNewFiles.length - 1;
        imageResources.reset();
        let lastUrl = "";
        try {
          lastUrl = await getOrLoadImageFile(sortedNewFiles[lastIndex]);
        } catch (error) {
          if (!(error instanceof StaleReaderImageRequest) && requestId === folderRequestRef.current) setError("当前图片加载失败，可以点击画面重试或翻到上一页");
        }
        if (requestId !== folderRequestRef.current) {
          return;
        }

        pageRequestRef.current++;
        setIsImageLoading(false);
        clearScrollImages();
        setCurrentIndex(lastIndex);
        setScrollPosition(0);
        setScrollHeight(0);
        finishScrollRestoration();
        setScrollTargetIndex(null);
        setFolderName(prevFolder.name);
        setFolderPath(prevFolder.path);
        sessionStorage.setItem("currentFolderPath", prevFolder.path);
        setFiles(sortedNewFiles);
        setImageUrl(lastUrl);
        setLoadingProgress(100);
        hasNoMoreFoldersRef.current = false;
      } catch (error) {
        console.error("加载上一文件夹失败:", error);
        if (requestId === folderRequestRef.current) {
          setError(error instanceof Error ? error.message : "无法加载上一章节");
        }
      } finally {
        if (requestId === folderRequestRef.current) setIsLoading(false);
        if (requestId === folderRequestRef.current) isLoadingPrevFolderRef.current = false;
      }
    },
    [viewMode, imageResources, clearScrollImages, getOrLoadImageFile, finishScrollRestoration]
  );

  const cancelPendingImageLoads = useCallback(() => {
    pageRequestRef.current++;
    folderRequestRef.current++;
    scrollLoadRequestRef.current++;
    pageRequestedPathRef.current = "";
  }, []);

  useEffect(() => {
    // A replay keeps the same ref-owned cache; an actual unmount cancels its
    // requests. Owner identity also prevents a refreshed cache orphaning an old one.
    return resourceLifecycle.mount(imageResources, cancelPendingImageLoads);
  }, [resourceLifecycle, imageResources, cancelPendingImageLoads]);

  /** 后台预加载相邻图片（距离当前页 ±2），翻页瞬间无闪烁 */
  const preloadAdjacent = useCallback(
    (baseIndex: number, generation: number) => {
      if (activeViewModeRef.current !== "page" || generation !== imageResources.generation || files.length === 0 || pageRequestedPathRef.current !== files[baseIndex]?.path) return;
      const start = Math.max(0, baseIndex - 2);
      const end = Math.min(files.length, baseIndex + 3);
      imageResources.retain(files.slice(start, end).map((file) => file.path));
      for (let i = start; i < end; i++) {
        if (i === baseIndex) continue;
        void getOrLoadImageFile(files[i]).catch(() => { /* The requested page exposes any read error. */ });
      }
    },
    [files, imageResources, getOrLoadImageFile],
  );

  const nextPage = useCallback(async () => {
    if (isLoadingRef.current || activeViewModeRef.current !== "page") return;
    if (currentIndex < files.length - 1) {
      const newIndex = currentIndex + 1;
      const generation = imageResources.generation;
      setCurrentIndex(newIndex);
      await loadImage(files[newIndex]);
      preloadAdjacent(newIndex, generation);
    } else if (viewMode === "page" && currentIndex === files.length - 1 && files.length > 0) {
      await loadNextFolder();
    }
  }, [currentIndex, files, loadImage, viewMode, loadNextFolder, preloadAdjacent, imageResources]);

  const prevPage = useCallback(async () => {
    if (isLoadingRef.current || activeViewModeRef.current !== "page") return;
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      const generation = imageResources.generation;
      setCurrentIndex(newIndex);
      await loadImage(files[newIndex]);
      preloadAdjacent(newIndex, generation);
    } else if (viewMode === "page" && currentIndex === 0 && files.length > 0) {
      // 章节第一页继续上一页：加载上一章节并定位到其最后一张
      await loadPreviousFolder();
    }
  }, [currentIndex, files, loadImage, viewMode, loadPreviousFolder, preloadAdjacent, imageResources]);

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
    if (isLoadingRef.current || isLoadingNextFolderRef.current || isLoadingPrevFolderRef.current) return;
    finishScrollRestoration();
    const newMode: ViewMode = activeViewModeRef.current === "page" ? "scroll" : "page";
    const currentFile = files[currentIndex];
    const preservePath = currentFile && imageResources.get(currentFile.path) ? currentFile.path : null;
    pageRequestRef.current++;
    scrollLoadRequestRef.current++;
    imageResources.reset(preservePath ? [preservePath] : []);
    activeViewModeRef.current = newMode;
    clearScrollImages();
    setIsImageLoading(false);
    setViewMode(newMode);

    if (newMode === "page") {
      const currentUrl = currentFile ? imageResources.get(currentFile.path)?.url ?? "" : "";
      setImageUrl(currentUrl);
      setScrollTargetIndex(null);
      setIsLoading(false);
      if (currentFile) {
        const generation = imageResources.generation;
        await loadImage(currentFile);
        preloadAdjacent(currentIndex, generation);
      }
      return;
    }

    if (newMode === "scroll" && files.length > 0) {
      const requestId = folderRequestRef.current;
      setScrollTargetIndex(currentIndex);
      setScrollPosition(0);
      setScrollHeight(0);
      setImageUrl("");
      isLoadingRef.current = true;
      setIsLoading(true);
      setLoadingProgress(0);
      await loadScrollImages(files, currentIndex, requestId);
    }
  }, [files, currentIndex, loadImage, imageResources, clearScrollImages, loadScrollImages, preloadAdjacent, finishScrollRestoration]);

  // 设置图片宽度
  const setImageWidthValue = useCallback((width: number) => {
    setImageWidth(Math.max(200, Math.min(2000, width)));
  }, []);

  const setImagesPerGroupValue = useCallback((count: number) => {
    setImagesPerGroup(normalizeImagesPerGroup(count));
  }, []);

  // 鼠标滚轮处理
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // Normal wheel scrolls in both modes. Ctrl/pinch zooms only the image.
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else if (e.deltaY > 0) zoomOut();
    },
    [zoomIn, zoomOut],
  );

  const setScrollRatioWrapped = useCallback(
    (ratio: number) => setScrollRatio(Math.max(0.1, Math.min(1.0, ratio))),
    [],
  );

  const goToPage = useCallback(
    (index: number) => {
      if (isLoadingRef.current) return;
      if (Number.isInteger(index) && index >= 0 && index < files.length) {
        finishScrollRestoration();
        setCurrentIndex(index);
        if (viewMode === "scroll") {
          setScrollPosition(0);
          setScrollHeight(0);
          imageResources.prioritize([index, index + 1, index - 1].map((page) => files[page]?.path).filter((path): path is string => Boolean(path)));
          setScrollTargetIndex(index);
          setScrollJumpRequest((request) => request + 1);
        } else {
          const generation = imageResources.generation;
          void loadImage(files[index]).then(() => preloadAdjacent(index, generation));
        }
      }
    },
    [files, viewMode, loadImage, preloadAdjacent, imageResources, finishScrollRestoration],
  );

  const onScrollPositionChange = useCallback(
    (position: number, height: number) => {
      if (isRestoringScrollPositionRef.current) return;
      setScrollPosition(position);
      setScrollHeight(height);
    },
    [],
  );

  const onCurrentImageChange = useCallback(
    (index: number) => {
      if (isRestoringScrollPositionRef.current) return;
      if (viewMode === "scroll") {
        imageResources.prioritize([index, index + 1, index - 1].map((page) => files[page]?.path).filter((path): path is string => Boolean(path)));
        setCurrentIndex(index);
      }
    },
    [viewMode, files, imageResources],
  );

  const retryImage = useCallback(async (index: number) => {
    const file = files[index];
    if (!file) return;
    if (viewMode === "page") {
      imageResources.remove(file.path);
      await loadImage(file);
      return;
    }
    const requestId = folderRequestRef.current;
    const generation = imageResources.generation;
    const scrollRequestId = scrollLoadRequestRef.current;
    imageResources.remove(file.path);
    try {
      const request = imageResources.load(file);
      imageResources.prioritize([file.path]);
      publishScrollSnapshot(files);
      await request;
      if (requestId !== folderRequestRef.current || generation !== imageResources.generation || scrollRequestId !== scrollLoadRequestRef.current || activeViewModeRef.current !== "scroll") return;
      publishScrollSnapshot(files);
      setError(null);
    } catch {
      if (requestId === folderRequestRef.current && generation === imageResources.generation && activeViewModeRef.current === "scroll") {
        publishScrollSnapshot(files);
        setError("图片仍无法加载，请检查原文件");
      }
    }
  }, [files, viewMode, loadImage, imageResources, publishScrollSnapshot]);

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
    setImagesPerGroup: setImagesPerGroupValue,
    setScrollRatio: setScrollRatioWrapped,
    goToPage,
    onScrollPositionChange,
    onCurrentImageChange,
    retryImage,
    finishScrollRestoration,
    persistHistory,
    flushHistory,
    loadNextFolder: loadNextFolderAction,
  }), [
    handleFolderSelect, nextPage, prevPage, zoomIn, zoomOut, resetZoom,
    handleWheel, toggleViewMode, setImageWidthValue, setImagesPerGroupValue, setScrollRatioWrapped,
    goToPage, onScrollPositionChange, onCurrentImageChange, retryImage, finishScrollRestoration, loadNextFolderAction, persistHistory, flushHistory,
  ]);

  const state = useMemo<ComicViewerState>(() => ({
    files,
    currentIndex,
    zoom,
    imageUrl,
    viewMode,
    imageWidth,
    imagesPerGroup,
    imageUrls,
    scrollImageStates,
    scrollImageSizes,
    isBackgroundLoading,
    isScrollLayoutReady,
    isRestoringScrollPosition,
    folderName,
    folderPath,
    scrollPosition,
    scrollHeight,
    scrollTargetIndex,
    scrollJumpRequest,
    scrollRatio,
    isLoading,
    isImageLoading,
    loadingProgress,
    error,
  }), [
    files, currentIndex, zoom, imageUrl, viewMode, imageWidth, imagesPerGroup, imageUrls,
    scrollImageStates, scrollImageSizes, isBackgroundLoading, isScrollLayoutReady, isRestoringScrollPosition,
    folderName, folderPath, scrollPosition, scrollHeight, scrollTargetIndex, scrollJumpRequest, scrollRatio,
    isLoading, isImageLoading, loadingProgress, error,
  ]);

  return { state, actions };
};
