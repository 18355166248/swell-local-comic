export interface ComicFile {
  name: string;
  path: string;
}

export type ViewMode = "page" | "scroll";

export interface ComicViewerState {
  files: ComicFile[];
  currentIndex: number;
  zoom: number;
  imageUrl: string;
  viewMode: ViewMode;
  imageWidth: number;
  imageUrls: string[];
  scrollPosition?: number;
  scrollHeight?: number;
  isLoading?: boolean;
  loadingProgress?: number; // 加载进度 0-100
}

export interface ReadingHistory {
  folderName: string;
  folderPath: string;
  files: ComicFile[];
  currentIndex: number;
  totalFiles: number;
  lastReadTime: number;
  firstReadTime?: number;
  currentFileName?: string;
  zoom?: number;
  viewMode?: ViewMode;
  imageWidth?: number;
  scrollPosition?: number;
  scrollHeight?: number; // 滚动内容的总高度
  imageUrls?: string[];
}

// 用于保存历史记录的数据结构（不包含自动生成的时间戳）
export interface ReadingHistoryInput {
  folderName: string;
  folderPath: string;
  files: ComicFile[];
  currentIndex: number;
  totalFiles: number;
  currentFileName?: string;
  zoom?: number;
  viewMode?: ViewMode;
  imageWidth?: number;
  scrollPosition?: number;
  scrollHeight?: number;
  imageUrls?: string[];
}

export interface FolderInfo {
  name: string;
  path: string;
}

export interface ImageFileInfo {
  name: string;
  path: string;
}

export interface LibraryItem {
  id: string;
  name: string;
  rootPath: string;
  addedAt: number;
  lastOpenedAt: number;
}

export interface ComicDirectoryNode {
  name: string;
  path: string;
  children: ComicDirectoryNode[];
  imageCount: number;
  readable: boolean;
}

export interface ComicChapter {
  name: string;
  path: string;
  relativePath: string;
  imageCount: number;
}

export interface ComicLibraryScanResult {
  root: FolderInfo;
  tree: ComicDirectoryNode;
  chapters: ComicChapter[];
}
