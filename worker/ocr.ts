export const OCR_MAX_PAGES_PER_REQUEST = 3;
export const OCR_MAX_IMAGE_CHARS = 1_200_000;

export interface OcrPageInput {
  page: number;
  imageBase64: string;
}

export function parseOcrPages(value: unknown): OcrPageInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("請提供至少一頁掃描影像。");
  }
  if (value.length > OCR_MAX_PAGES_PER_REQUEST) {
    throw new Error(`每次最多辨識 ${OCR_MAX_PAGES_PER_REQUEST} 頁。`);
  }
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`第 ${index + 1} 頁影像無效。`);
    const page = (item as { page?: unknown }).page;
    const imageBase64 = (item as { imageBase64?: unknown }).imageBase64;
    if (typeof page !== "number" || !Number.isFinite(page) || page < 1) {
      throw new Error(`第 ${index + 1} 頁的頁碼無效。`);
    }
    if (typeof imageBase64 !== "string" || imageBase64.length < 32) {
      throw new Error(`第 ${page} 頁沒有影像資料。`);
    }
    if (imageBase64.length > OCR_MAX_IMAGE_CHARS) {
      throw new Error(`第 ${page} 頁影像過大，請縮小後再試。`);
    }
    return { page, imageBase64 };
  });
}

export function splitOcrTranscript(text: string, pageNumbers: number[]): Array<{ page: number; text: string }> {
  const matches = [...text.matchAll(/【第\s*(\d+)\s*頁】/g)];
  if (matches.length === 0) {
    const trimmed = text.trim();
    return pageNumbers.map((page, index) => ({ page, text: index === 0 ? trimmed : "" }));
  }
  const chunks = new Map<number, string>();
  for (let index = 0; index < matches.length; index += 1) {
    const page = Number(matches[index][1]);
    const start = (matches[index].index || 0) + matches[index][0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index || text.length : text.length;
    chunks.set(page, text.slice(start, end).trim());
  }
  return pageNumbers.map((page) => ({ page, text: chunks.get(page) || "" }));
}
