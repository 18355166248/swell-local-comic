export interface ComicFile {
  name: string;
  handle: FileSystemFileHandle;
}

export interface ComicViewerState {
  files: ComicFile[];
  currentIndex: number;
  zoom: number;
  imageUrl: string;
}
