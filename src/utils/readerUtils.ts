/** Default legacy histories to one image per row; reject invalid counts before building rows. */
export const normalizeImagesPerGroup = (value: unknown): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 20 ? value : 1;

export const parsePageNumber = (value: string, total: number): number | null => {
  if (!/^\d+$/.test(value.trim())) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= total ? page - 1 : null;
};

export const getPageRange = (currentIndex: number, total: number, size = 12) => {
  const safeTotal = Math.max(0, Math.floor(total));
  const safeSize = Math.max(1, Math.floor(size));
  const index = Math.min(Math.max(0, Math.floor(currentIndex)), Math.max(0, safeTotal - 1));
  const start = Math.floor(index / safeSize) * safeSize;
  return { start, end: Math.min(start + safeSize, safeTotal) };
};
