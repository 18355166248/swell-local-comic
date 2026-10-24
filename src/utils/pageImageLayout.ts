export type PageImageFit = "height" | "contain" | "original";

export interface ImageDimensions {
  width: number;
  height: number;
}

export function getPageImageLayout(
  image: ImageDimensions | null,
  viewport: ImageDimensions,
  fit: PageImageFit,
  zoom: number,
): ImageDimensions {
  if (!image || image.width <= 0 || image.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return { width: 0, height: 0 };
  }

  const fitScale = fit === "height"
    ? viewport.height / image.height
    : fit === "contain"
      ? Math.min(viewport.width / image.width, viewport.height / image.height)
      : 1;
  const scale = fitScale * zoom;

  if (fit === "height" || (fit === "contain" && viewport.height / image.height <= viewport.width / image.width)) {
    const height = Math.max(1, Math.floor(image.height * scale));
    return { width: height * image.width / image.height, height };
  }

  const width = Math.max(1, Math.floor(image.width * scale));
  return { width, height: width * image.height / image.width };
}
