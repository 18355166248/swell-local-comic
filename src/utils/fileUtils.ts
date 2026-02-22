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

/**
 * 获取当前文件夹同级的下一个文件夹（按名称排序）
 * 用于滚动到底部时实现文件夹级连续阅读
 */
export const getNextSiblingFolder = async (
  folderPath: string
): Promise<FolderInfo | null> => {
  try {
    const result = await invoke<FolderInfo | null>("get_next_sibling_folder", {
      folderPath,
    });
    return result;
  } catch (error) {
    console.error("获取下一同级文件夹失败:", error);
    return null;
  }
};

/**
 * 自然排序比较函数，处理文件名中的数字
 * 例如：6-1 会排在 10-1 前面
 */
export const naturalSort = (a: string, b: string): number => {
  // 移除文件扩展名进行比较
  const getBaseName = (filename: string) => {
    const lastDotIndex = filename.lastIndexOf(".");
    return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  };

  const nameA = getBaseName(a);
  const nameB = getBaseName(b);

  // 将文件名分割成数字和非数字部分
  const splitName = (name: string): Array<string | number> => {
    const parts: Array<string | number> = [];
    let currentPart = "";
    let isNumber = false;

    for (let i = 0; i < name.length; i++) {
      const char = name[i];
      const charIsNumber = /^\d$/.test(char);

      if (i === 0) {
        isNumber = charIsNumber;
        currentPart = char;
      } else if (charIsNumber === isNumber) {
        currentPart += char;
      } else {
        // 类型改变，保存当前部分
        parts.push(isNumber ? parseInt(currentPart, 10) : currentPart);
        currentPart = char;
        isNumber = charIsNumber;
      }
    }

    // 保存最后一部分
    if (currentPart) {
      parts.push(isNumber ? parseInt(currentPart, 10) : currentPart);
    }

    return parts;
  };

  const partsA = splitName(nameA);
  const partsB = splitName(nameB);

  // 比较每个部分
  const maxLength = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLength; i++) {
    const partA = partsA[i];
    const partB = partsB[i];

    // 如果某个部分不存在，较短的排在前面
    if (partA === undefined) return -1;
    if (partB === undefined) return 1;

    // 如果类型不同，字符串排在数字前面
    if (typeof partA !== typeof partB) {
      return typeof partA === "string" ? -1 : 1;
    }

    // 相同类型比较
    if (typeof partA === "number" && typeof partB === "number") {
      if (partA !== partB) {
        return partA - partB;
      }
    } else if (typeof partA === "string" && typeof partB === "string") {
      const comparison = partA.localeCompare(partB);
      if (comparison !== 0) {
        return comparison;
      }
    }
  }

  // 如果所有部分都相同，比较完整文件名（包括扩展名）
  return a.localeCompare(b);
};

/**
 * 对文件列表进行自然排序
 */
export const sortFiles = (files: ComicFile[]): ComicFile[] => {
  return [...files].sort((a, b) => naturalSort(a.name, b.name));
};

export const scanImageFiles = async (
  folderPath: string
): Promise<ComicFile[]> => {
  try {
    const imageFiles: ImageFileInfo[] = await invoke("read_image_files", {
      folderPath,
    });

    // 转换为ComicFile格式
    const files = imageFiles.map((file) => ({
      name: file.name,
      path: file.path,
    }));

    // 使用自然排序对文件进行排序
    files.sort((a, b) => naturalSort(a.name, b.name));

    return files;
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
