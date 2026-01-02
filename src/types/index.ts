export interface ComicFile {
  name: string;
  handle: FileSystemFileHandle;
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
