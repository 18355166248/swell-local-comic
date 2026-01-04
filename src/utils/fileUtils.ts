import { invoke } from "@tauri-apps/api/core";
import type { ComicFile, FolderInfo, ImageFileInfo } from "../types";

console.log("🚀 ~ invoke:", invoke);
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

export const selectFolder = async (): Promise<FolderInfo | null> => {
  try {
    const result = await invoke<FolderInfo | null>("select_folder");
    return result;
  } catch (error) {
    console.error("选择文件夹失败:", error);
    throw error;
  }
};

export const scanImageFiles = async (
  folderPath: string
): Promise<ComicFile[]> => {
  try {
    const imageFiles: ImageFileInfo[] = await invoke("read_image_files", {
      folderPath,
    });

    // 转换为ComicFile格式
    return imageFiles.map((file) => ({
      name: file.name,
      path: file.path,
    }));
  } catch (error) {
    console.error("扫描图片文件失败:", error);
    throw error;
  }
};

export const loadImageFile = async (file: ComicFile): Promise<string> => {
  try {
    const data: number[] = await invoke("read_image_file", {
      filePath: file.path,
    });

    // 将字节数组转换为Uint8Array
    const uint8Array = new Uint8Array(data);

    // 创建Blob并生成URL
    const blob = new Blob([uint8Array], { type: "image/*" });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("加载图片文件失败:", error);
    throw error;
  }
};
