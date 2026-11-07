import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseOcrPages, splitOcrTranscript } from "./ocr.ts";

test("ocr request rejects oversized batches and keeps page transcripts", () => {
  assert.throws(() => parseOcrPages([{ page: 1, imageBase64: "a".repeat(40) }, { page: 2, imageBase64: "b".repeat(40) }, { page: 3, imageBase64: "c".repeat(40) }, { page: 4, imageBase64: "d".repeat(40) }]), /3 頁/);
  const pages = parseOcrPages([{ page: 4, imageBase64: "a".repeat(40) }]);
  assert.equal(pages[0].page, 4);

  const split = splitOcrTranscript("前言\n【第4頁】\n天主聖三\n【第5頁】\n聖體", [4, 5]);
  assert.deepEqual(split, [
    { page: 4, text: "天主聖三" },
    { page: 5, text: "聖體" },
  ]);
});

test("worker exposes batched OCR beside the Poe chat endpoint", () => {
  const worker = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  assert.match(worker, /\/api\/ocr-pages/);
  assert.match(worker, /VISION_MODEL/);
  assert.equal(worker.includes("POE_API_KEY="), false);
});
