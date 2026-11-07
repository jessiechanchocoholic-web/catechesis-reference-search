import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";

interface PdfTextRun {
  str: string;
  hasEOL: boolean;
  transform: number[];
}
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { CatechismDocument } from "../types";
import { classifyDocumentContent } from "./classify";
import {
  OCR_BATCH_SIZE,
  OCR_MAX_PAGES,
  assertPdfFileSize,
  combinePageText,
  joinPdfTextItems,
  pagesNeedingOcr,
} from "./pdfText";

GlobalWorkerOptions.workerSrc = workerUrl;

const PDFJS_ASSET_BASE = "/pdfjs/";

export type PdfProgress = (message: string) => void;

interface PageText {
  page: number;
  text: string;
}

function isTextItem(item: unknown): item is PdfTextRun {
  return Boolean(item) && typeof item === "object" && "str" in item && typeof (item as { str?: unknown }).str === "string";
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("無法產生頁面影像"));
      else resolve(blob);
    }, "image/jpeg", quality);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("無法讀取頁面影像"));
    reader.readAsDataURL(blob);
  });
}

async function renderPageJpeg(pdf: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  try {
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1280 / base.width, 1.7);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    let blob = await canvasToJpeg(canvas, 0.68);
    if (blob.size > 700_000) {
      const smaller = page.getViewport({ scale: Math.min(1000 / base.width, scale) });
      canvas.width = Math.ceil(smaller.width);
      canvas.height = Math.ceil(smaller.height);
      await page.render({ canvas, viewport: smaller }).promise;
      blob = await canvasToJpeg(canvas, 0.55);
    }
    canvas.width = 0;
    canvas.height = 0;
    if (blob.size > 1_000_000) {
      throw new Error(`第 ${pageNumber} 頁影像過大，已跳過。`);
    }
    return blobToBase64(blob);
  } finally {
    page.cleanup();
  }
}

async function ocrPages(
  fileName: string,
  pdf: PDFDocumentProxy,
  pageNumbers: number[],
  onProgress?: PdfProgress,
): Promise<{ recognized: Map<number, string>; failures: string[] }> {
  const recognized = new Map<number, string>();
  const failures: string[] = [];
  for (let index = 0; index < pageNumbers.length; index += OCR_BATCH_SIZE) {
    const group = pageNumbers.slice(index, index + OCR_BATCH_SIZE);
    onProgress?.(
      `掃描頁辨識 ${Math.min(index + group.length, pageNumbers.length)}/${pageNumbers.length}（第 ${group[0]}–${group[group.length - 1]} 頁）`,
    );
    const pages = [];
    for (const pageNumber of group) {
      try {
        pages.push({ page: pageNumber, imageBase64: await renderPageJpeg(pdf, pageNumber) });
      } catch (error) {
        failures.push(error instanceof Error ? error.message : `第 ${pageNumber} 頁無法轉成影像。`);
      }
    }
    if (pages.length === 0) continue;
    const response = await fetch("/api/ocr-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, pages }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error || "掃描頁辨識失敗";
      if (response.status === 401 || response.status === 402 || response.status === 503) {
        throw new Error(message);
      }
      failures.push(`第 ${pages.map((page) => page.page).join("、")} 頁：${message}`);
      continue;
    }
    const returned = Array.isArray(data.pages) ? data.pages : [];
    for (const item of returned) {
      if (item && typeof item.page === "number") {
        recognized.set(item.page, typeof item.text === "string" ? item.text : "");
      }
    }
  }
  return { recognized, failures };
}

async function refineMetadata(fileName: string, text: string): Promise<{ title: string; category: string }> {
  let title = fileName.replace(/\.pdf$/i, "");
  let category = classifyDocumentContent(title, text);
  try {
    const response = await fetch("/api/process-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName,
        fileType: "text/plain",
        rawContent: text.slice(0, 4000),
      }),
    });
    if (response.ok) {
      const data = await response.json();
      if (typeof data.category === "string" && data.category.trim()) category = data.category.trim();
      if (typeof data.title === "string" && data.title.trim().length > 2) title = data.title.trim();
    }
  } catch {
    // Local classification is enough when the model is unavailable.
  }
  return { title, category };
}

export async function extractPdfDocument(
  file: File,
  onProgress?: PdfProgress,
): Promise<Omit<CatechismDocument, "id">> {
  assertPdfFileSize(file.size);
  onProgress?.("正在開啟 PDF…");
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = getDocument({
    data,
    cMapUrl: `${PDFJS_ASSET_BASE}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_ASSET_BASE}standard_fonts/`,
    wasmUrl: `${PDFJS_ASSET_BASE}wasm/`,
    useSystemFonts: true,
  });

  let pdf: PDFDocumentProxy | null = null;
  try {
    pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    if (pageCount < 1) throw new Error("這份 PDF 沒有可讀頁面。");

    const pages: PageText[] = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      onProgress?.(`正在讀取文字層 ${pageNumber}/${pageCount} 頁`);
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const text = joinPdfTextItems(
          content.items.flatMap((item) => {
            if (!isTextItem(item)) return [];
            return [{
              str: item.str,
              hasEOL: Boolean(item.hasEOL),
              y: Array.isArray(item.transform) ? Number(item.transform[5]) : undefined,
            }];
          }),
        );
        pages.push({ page: pageNumber, text });
      } finally {
        page.cleanup();
      }
      if (pageNumber % 2 === 0) await yieldToBrowser();
    }

    const missing = pagesNeedingOcr(pages);
    const targets = missing.slice(0, OCR_MAX_PAGES);
    const skipped = missing.length - targets.length;
    let failures: string[] = [];
    if (targets.length > 0) {
      onProgress?.(`發現 ${missing.length} 頁沒有文字層，開始分批辨識`);
      const ocr = await ocrPages(file.name, pdf, targets, onProgress);
      failures = ocr.failures;
      for (const page of pages) {
        if (ocr.recognized.has(page.page)) page.text = ocr.recognized.get(page.page) || "";
      }
    }

    const notes = [
      skipped > 0
        ? `【館員備註】此 PDF 有 ${missing.length} 頁缺少文字層。已辨識前 ${targets.length} 頁，其餘 ${skipped} 頁超出單次辨識上限。請把該書拆成較短的 PDF 再上載。`
        : "",
      failures.length > 0 ? `【未能辨識】${failures.slice(0, 8).join("；")}` : "",
    ].filter(Boolean);
    const note = notes.length > 0 ? notes.join("\n") : undefined;
    const content = combinePageText(pages, note);
    if (content.replace(/\s+/g, "").length < 20) {
      throw new Error("未能從這份 PDF 抽出文字。若是掃描檔，請確認網路與 Poe 辨識服務可用。");
    }

    onProgress?.("正在為文獻分類…");
    const meta = await refineMetadata(file.name, content);
    const ocrCount = targets.length;
    const sourceMeta =
      ocrCount > 0
        ? `由 PDF 掃描辨識上載：${file.name}（${pageCount} 頁，已辨識 ${ocrCount} 頁）`
        : `由 PDF 文字層上載：${file.name}（${pageCount} 頁）`;

    return {
      title: meta.title,
      category: meta.category,
      content,
      sourceMeta,
      uploadedAt: new Date().toISOString(),
      fileType: "pdf",
      wordCount: content.length,
    };
  } catch (error) {
    const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
    if (name === "PasswordException") throw new Error("這份 PDF 設有密碼，請先解除密碼再上載。");
    if (name === "InvalidPDFException") throw new Error("這不是有效的 PDF 檔案。");
    throw error;
  } finally {
    await pdf?.cleanup().catch(() => undefined);
    await loadingTask.destroy().catch(() => undefined);
  }
}
