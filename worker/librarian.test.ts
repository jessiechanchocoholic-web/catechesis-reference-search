import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseJsonFromModel, splitReportAndSources } from "./citations.ts";
import { lexicalExtractCitations } from "./librarian.ts";

test("preset catechesis documents stay in the library and use Sigao wording", () => {
  const text = readFileSync(new URL("../src/data/sampleCatechism.ts", import.meta.url), "utf8");
  const ids = [...text.matchAll(/id: "(preset-[^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, [
    "preset-ccc-faith",
    "preset-ccc-sacraments",
    "preset-ccc-morality",
    "preset-ccc-prayer",
    "preset-scripture-prodigal-son",
    "preset-vatican-ii-lumen-gentium",
  ]);
  assert.match(text, /思高/);
  assert.equal(/上帝|聖靈|馬太福音|和合本/.test(text), false);
});

test("parses fenced model JSON and lexical fallback quotes", () => {
  const parsed = parseJsonFromModel('```json\n{"searchSummary":"ok","citations":[]}\n```');
  assert.equal((parsed as { searchSummary: string }).searchSummary, "ok");

  const citations = lexicalExtractCitations("實質轉變", [
    {
      id: "doc-1",
      title: "聖體",
      category: "禮儀聖事",
      content: "第1376條：這種奇妙而獨特的轉變，公教會適當地稱之為實質轉變。",
    },
  ]);
  assert.equal(citations.length, 1);
  assert.match(citations[0].exactQuote, /實質轉變/);
  assert.equal(citations[0].documentId, "doc-1");
});

test("keeps web-search citation urls and drops the machine-readable trailer", () => {
  const { report, sources } = splitReportAndSources(
    "聖體聖事見[天主教教理](https://www.vatican.va/archive/ccc.htm)。\nCITATIONS_JSON: [{\"title\":\"思高聖經\",\"uri\":\"https://www.ccreadv.com/\"}]",
    {
      choices: [
        {
          message: {
            content: "ignored",
            citations: [{ title: "主教團", url: "https://www.catholic.org.tw/page" }],
          },
        },
      ],
    },
  );
  assert.equal(report.includes("CITATIONS_JSON"), false);
  assert.deepEqual(
    sources.map((source) => source.uri),
    [
      "https://www.ccreadv.com/",
      "https://www.catholic.org.tw/page",
      "https://www.vatican.va/archive/ccc.htm",
    ],
  );
});

test("reads Responses API web_search sources and url citations", () => {
  const { sources } = splitReportAndSources("若望福音記載增餅。", {
    output: [
      {
        type: "web_search_call",
        action: {
          sources: [{ type: "url", url: "https://www.vatican.va/archive/ENG0015/_INDEX.HTM" }],
        },
      },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: "若望福音記載增餅。",
            annotations: [
              {
                type: "url_citation",
                url: "https://www.ccreadv.com/john6",
                title: "思高聖經若望福音",
              },
            ],
          },
        ],
      },
    ],
  });
  assert.deepEqual(
    sources.map((source) => source.title),
    ["https://www.vatican.va/archive/ENG0015/_INDEX.HTM", "思高聖經若望福音"],
  );
});

test("worker config keeps the Poe key out of public vars", () => {
  const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const poe = readFileSync(new URL("./poe.ts", import.meta.url), "utf8");
  const worker = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  assert.equal(/"POE_API_KEY"\s*:/.test(wrangler), false);
  assert.equal(wrangler.includes("GEMINI"), false);
  assert.match(poe, /https:\/\/api\.poe\.com\/v1\/chat\/completions/);
  assert.match(poe, /DEFAULT_WEB_SEARCH_MODEL = "Web-Search"/);
  assert.match(worker, /WEB_SEARCH_MODEL/);
  assert.equal(/GEMINI|@google\/genai|googleSearch/.test(worker + poe), false);
});
