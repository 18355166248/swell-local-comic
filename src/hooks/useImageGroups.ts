import { useMemo } from "react";
import type { ViewMode } from "../types";

interface ImageGroup {
  urls: string[];
  files: Array<{ name: string; path: string }>;
  groupIndex: number;
}

export function useImageGroups(
  imageUrls: string[],
  files: Array<{ name: string; path: string }>,
  imagesPerGroup: number,
  viewMode: ViewMode
): ImageGroup[] {
  return useMemo(() => {
    if (viewMode !== "scroll" || imagesPerGroup <= 1) {
      return imageUrls.map((url, index) => ({
        urls: [url],
        files: [files[index]],
        groupIndex: index,
      }));
    }

    const groups: ImageGroup[] = [];

    for (let i = 0; i < imageUrls.length; i += imagesPerGroup) {
      groups.push({
        urls: imageUrls.slice(i, i + imagesPerGroup),
        files: files.slice(i, i + imagesPerGroup),
        groupIndex: Math.floor(i / imagesPerGroup),
      });
    }

    return groups;
  }, [imageUrls, files, imagesPerGroup, viewMode]);
}
