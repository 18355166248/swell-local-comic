import type { ComicFile } from "../types";

// 支持的图片格式
export const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
];

export const isImageFile = (filename: string): boolean => {
  const extension = filename.toLowerCase().substring(filename.lastIndexOf("."));
  return IMAGE_EXTENSIONS.includes(extension);
};

export const scanImageFiles = async (
  dirHandle: FileSystemDirectoryHandle
): Promise<ComicFile[]> => {
  const fileList: ComicFile[] = [];

  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === "file" && isImageFile(name)) {
      fileList.push({ name, handle });
    }
  }

  // 按文件名排序
  fileList.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true })
  );

  return fileList;
};

export const loadImageFile = async (file: ComicFile): Promise<string> => {
  const fileHandle = await file.handle.getFile();
  return URL.createObjectURL(fileHandle);
};
