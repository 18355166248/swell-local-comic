export interface ComicFile {
  name: string;
  path: string;
}

export type ViewMode = 'page' | 'scroll';

export interface ComicViewerState {
  files: ComicFile[];
  currentIndex: number;
  zoom: number;
  imageUrl: string;
  viewMode: ViewMode;
  imageWidth: number;
  imageUrls: string[];
}

export interface ReadingHistory {
  folderName: string;
  currentIndex: number;
  totalFiles: number;
  lastReadTime: number;
  currentFileName?: string;
  zoom?: number;
  viewMode?: ViewMode;
  imageWidth?: number;
}

export interface FolderInfo {
  name: string;
  path: string;
}

export interface ImageFileInfo {
  name: string;
  path: string;
}
