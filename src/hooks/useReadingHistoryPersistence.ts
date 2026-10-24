import { useCallback, useEffect, useMemo, type RefObject } from "react";
import type { ComicViewerState, ReadingHistoryInput } from "../types";
import { createBufferedWriter } from "../utils/bufferedWriter";
import { saveHistory } from "../utils/historyUtils";
import { normalizeLibraryPathId } from "../utils/libraryUtils";
import type { ScrollPositionSnapshot } from "../utils/readerPosition";

export type ReadingHistoryState = Pick<ComicViewerState,
  "folderName" | "folderPath" | "files" | "currentIndex" | "zoom" |
  "viewMode" | "imageWidth" | "scrollRatio" | "scrollPosition" |
  "scrollHeight" | "isLoading" | "isRestoringScrollPosition"
>;

/** Build from the current reader, optionally including a scroll event before React commits it. */
export function buildReadingHistoryInput(
  state: ReadingHistoryState,
  snapshot?: ScrollPositionSnapshot,
): ReadingHistoryInput | null {
  if (!state.folderName || !state.folderPath || state.files.length === 0 || state.isLoading) return null;
  // Placeholder layout is not the restored reading position. An early exit must
  // preserve the saved location until restoration completes or the user cancels it.
  const scrollSnapshot = state.isRestoringScrollPosition ? undefined : snapshot;
  return {
    folderName: state.folderName,
    folderPath: state.folderPath,
    files: state.files,
    currentIndex: state.currentIndex,
    totalFiles: state.files.length,
    currentFileName: state.files[state.currentIndex]?.name,
    zoom: state.zoom,
    viewMode: state.viewMode,
    imageWidth: state.imageWidth,
    scrollRatio: state.scrollRatio,
    scrollPosition: state.viewMode === "scroll" ? scrollSnapshot?.position ?? state.scrollPosition : undefined,
    scrollHeight: state.viewMode === "scroll" ? scrollSnapshot?.height ?? state.scrollHeight : undefined,
  };
}

export function useReadingHistoryPersistence({
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
  isLoading,
  isRestoringScrollPosition,
}: ReadingHistoryState, restorationPendingRef?: RefObject<boolean>) {
  const historyWriter = useMemo(() => createBufferedWriter(saveHistory), []);
  const historyState = useMemo<ReadingHistoryState>(() => ({
    folderName, folderPath, files, currentIndex, zoom, viewMode,
    imageWidth, scrollRatio, scrollPosition, scrollHeight, isLoading, isRestoringScrollPosition,
  }), [
    folderName, folderPath, files, currentIndex, zoom, viewMode,
    imageWidth, scrollRatio, scrollPosition, scrollHeight, isLoading, isRestoringScrollPosition,
  ]);

  useEffect(() => {
    const history = buildReadingHistoryInput(historyState);
    if (history) historyWriter.schedule(normalizeLibraryPathId(history.folderPath), history);
  }, [historyState, historyWriter]);

  const persistHistory = useCallback((snapshot?: ScrollPositionSnapshot) => {
    const history = buildReadingHistoryInput({
      ...historyState,
      // User intent can finish restoration and leave in the same event, before
      // the state flag commits. Read the synchronous latch for explicit saves.
      isRestoringScrollPosition: restorationPendingRef?.current ?? historyState.isRestoringScrollPosition,
    }, snapshot);
    if (history) historyWriter.schedule(normalizeLibraryPathId(history.folderPath), history);
    // Include the immediate DOM snapshot in this write, without awaiting setState.
    historyWriter.flush();
  }, [historyState, historyWriter, restorationPendingRef]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") historyWriter.flush();
    };
    window.addEventListener("pagehide", historyWriter.flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", historyWriter.flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      historyWriter.flush();
    };
  }, [historyWriter]);

  return { persistHistory, flushHistory: historyWriter.flush };
}
