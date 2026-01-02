import type { ViewMode } from "../types";

interface ImageViewerProps {
  imageUrl: string;
  currentFileName?: string;
  zoom: number;
  onWheel: (e: React.WheelEvent) => void;
  viewMode: ViewMode;
  imageWidth: number;
  imageUrls: string[];
  files: Array<{ name: string }>;
}

export default function ImageViewer({
  imageUrl,
  currentFileName,
  zoom,
  onWheel,
  viewMode,
  imageWidth,
  imageUrls,
  files
}: ImageViewerProps) {
  if (!imageUrl && imageUrls.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="text-6xl mb-4">📚</div>
          <p>请先选择包含漫画图片的文件夹</p>
          <p className="text-sm mt-2">支持格式：JPG, PNG, GIF, WebP, BMP</p>
        </div>
      </div>
    );
  }

  // 滚动模式：显示所有图片
  if (viewMode === 'scroll') {
    return (
      <div
        className="h-full overflow-y-auto overflow-x-hidden"
        onWheel={onWheel}
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="flex flex-col items-center py-4 space-y-4">
          {imageUrls.map((url, index) => (
            <img
              key={index}
              src={url}
              alt={files[index]?.name || `图片 ${index + 1}`}
              className="select-none"
              style={{
                width: `${imageWidth * zoom}px`,
                maxWidth: '100%',
                height: 'auto',
                objectFit: 'contain'
              }}
              draggable={false}
            />
          ))}
        </div>
      </div>
    );
  }

  // 分页模式：显示单张图片
  return (
    <div
      className="h-full flex items-center justify-center cursor-grab"
      onWheel={onWheel}
    >
      <img
        src={imageUrl}
        alt={currentFileName}
        className="max-h-full max-w-full object-contain select-none"
        style={{ transform: `scale(${zoom})` }}
        draggable={false}
      />
    </div>
  );
}
