export const PDF_MAX_BYTES = 80 * 1024 * 1024;
export const OCR_MAX_PAGES = 60;
export const OCR_BATCH_SIZE = 2;
export const OCR_MIN_CHARS_PER_PAGE = 15;

export interface PdfTextItem {
  str: string;
  hasEOL?: boolean;
  y?: number;
}

const CJK = /[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/;

function needsGap(previous: string, next: string): boolean {
  const left = previous.slice(-1);
  const right = next[0];
  if (!left || !right) return false;
  if (CJK.test(left) || CJK.test(right)) return false;
  if (/[\s，。、；：！？）》」』,.!?;:]/.test(right)) return false;
  if (/[（《「『]/.test(left)) return false;
  return /[A-Za-z0-9]/.test(left) && /[A-Za-z0-9]/.test(right);
}

export function joinPdfTextItems(items: PdfTextItem[]): string {
  let out = "";
  let lastY: number | undefined;

  for (const item of items) {
    const str = item.str || "";
    const y = typeof item.y === "number" && Number.isFinite(item.y) ? item.y : undefined;
    if (str) {
      const newLine =
        lastY != null && y != null && Math.abs(lastY - y) > 8 && out.length > 0 && !out.endsWith("\n");
      if (newLine) out += "\n";
      else if (out && !out.endsWith("\n") && !out.endsWith(" ") && needsGap(out, str)) out += " ";
      out += str;
    }
    if (item.hasEOL && out && !out.endsWith("\n")) out += "\n";
    if (y != null) lastY = y;
  }

  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function pagesNeedingOcr(
  pages: Array<{ page: number; text: string }>,
  minChars = OCR_MIN_CHARS_PER_PAGE,
): number[] {
  return pages
    .filter((page) => page.text.replace(/\s+/g, "").length < minChars)
    .map((page) => page.page);
}

export function assertPdfFileSize(bytes: number): void {
  if (bytes > PDF_MAX_BYTES) {
    throw new Error(`PDF 超過 ${Math.round(PDF_MAX_BYTES / (1024 * 1024))}MB，請先拆成較小的檔案再上載。`);
  }
}

export function combinePageText(
  pages: Array<{ page: number; text: string }>,
  note?: string,
): string {
  const body = [...pages]
    .sort((a, b) => a.page - b.page)
    .map((page) => `【第${page.page}頁】\n${page.text.trim()}`)
    .join("\n\n");
  return note ? `${body}\n\n${note}`.trim() : body.trim();
}
