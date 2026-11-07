import assert from "node:assert/strict";
import test from "node:test";
import {
  OCR_MAX_PAGES,
  assertPdfFileSize,
  combinePageText,
  joinPdfTextItems,
  pagesNeedingOcr,
} from "./pdfText.ts";
import { mergeLibrary, parseLibraryFile, toSearchPayload } from "./libraryFile.ts";

test("joins Chinese PDF text without inserting spaces between characters", () => {
  const text = joinPdfTextItems([
    { str: "天", y: 100 },
    { str: "主", y: 100 },
    { str: "聖", y: 100 },
    { str: "體", y: 100, hasEOL: true },
    { str: "實質轉變", y: 80 },
    { str: " transubstantiation", y: 80 },
  ]);
  assert.equal(text, "天主聖體\n實質轉變 transubstantiation");
});

test("keeps a space between Latin words and marks sparse pages for OCR", () => {
  const text = joinPdfTextItems([
    { str: "Hello", y: 10 },
    { str: "world", y: 10 },
  ]);
  assert.equal(text, "Hello world");

  const missing = pagesNeedingOcr([
    { page: 1, text: "第1376條 實質轉變是聖體聖事的核心教導，文字層足夠。" },
    { page: 2, text: "   " },
    { page: 3, text: "x" },
  ]);
  assert.deepEqual(missing, [2, 3]);
  assert.equal(missing.slice(0, OCR_MAX_PAGES).length, 2);
});

test("rejects oversized PDFs and keeps page markers", () => {
  assert.throws(() => assertPdfFileSize(81 * 1024 * 1024), /80MB/);
  const combined = combinePageText(
    [
      { page: 2, text: "第二頁" },
      { page: 1, text: "第一頁" },
    ],
    "【館員備註】已截斷",
  );
  assert.match(combined, /【第1頁】\n第一頁/);
  assert.match(combined, /【第2頁】\n第二頁/);
  assert.match(combined, /已截斷/);
});

test("library import merges by id and search payload drops images", () => {
  const imported = parseLibraryFile(
    JSON.stringify({
      kind: "catechesis-library",
      version: 1,
      documents: [
        { id: "book-1", title: "教理課本", category: "信德信條", content: "天主聖三", wordCount: 4 },
      ],
    }),
  );
  const merged = mergeLibrary(
    [{ id: "book-1", title: "舊", category: "信德信條", content: "舊", uploadedAt: "2020-01-01", wordCount: 1 }],
    imported,
  );
  assert.equal(merged[0].title, "教理課本");
  assert.equal(merged[0].content, "天主聖三");

  const payload = toSearchPayload([
    {
      id: "img",
      title: "圖",
      category: "聖經經文與註釋",
      content: "甲".repeat(20000),
      uploadedAt: "2026-01-01",
      wordCount: 20000,
      imageUrl: "data:image/png;base64,AAAA",
    },
  ]);
  assert.equal("imageUrl" in payload[0], false);
  assert.equal(payload[0].content.length, 15000);
});
