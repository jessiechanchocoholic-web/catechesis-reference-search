import { archiveBase64 } from "./pkg/archive.generated.ts";
import { chatText, parseJsonFromModel, responsesText, splitReportAndSources, type WebSource } from "./citations.ts";
import {
  SIGAO_RULE,
  classifyDocumentContent,
  lexicalExtractCitations,
  type LibraryDocument,
} from "./librarian.ts";
import {
  DEFAULT_MODEL,
  DEFAULT_WEB_SEARCH_MODEL,
  PoeError,
  poeChat,
  poeWebSearchResponse,
  publicPoeError,
} from "./poe.ts";
import { parseOcrPages, splitOcrTranscript } from "./ocr.ts";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  POE_API_KEY?: string;
  MODEL?: string;
  WEB_SEARCH_MODEL?: string;
  VISION_MODEL?: string;
}

const CANONICAL_SOURCES: WebSource[] = [
  { uri: "https://www.vatican.va/archive/ENG0015/_INDEX.HTM", title: "梵蒂岡宗座聖座《天主教教理》(CCC) 官方全文庫" },
  { uri: "https://www.ccreadv.com", title: "思高聖經學會經文及註釋檢索庫 (SBF)" },
  { uri: "https://www.vatican.va/content/vatican/zh.html", title: "梵蒂岡宗座聖座官方中文文獻庫" },
  { uri: "https://www.catholic.org.tw", title: "天主教台灣地區主教團權威文獻專區" },
];

const CUSTOM_SYSTEM = `你是一位專業、嚴謹的「天主教教理講授資料庫參考館員」（Theological & Catechetical Reference Librarian）。
【最高使命與原則】：
1. 使用者是資深的教理講授員或牧民工作者，他們只需要你像圖書館員一樣，依據讀者所提出的問題或關鍵字，在他們「已上載的自訂文件庫」中尋找並定位相關文獻資料。
2. 【絕對禁令】：絕不撰寫教案、絕不撰寫講道辭、絕不設計課堂活動或問答題、絕不自行增添說教或主觀抒情。
3. 你的任務純粹是：查找資料、精確引文、標註段落章節出處、提供前後文脈，以便使用者之後親自細閱並自行處理。
4. 所有引用必須忠於提供的自訂文件內容，不得憑空捏造文件中不存在的字句。
5. 請以繁體中文（台灣/香港常用之天主教牧民與教理名詞，如「天主、聖神、聖體、彌撒、告解、福音」）輸出。
6. ${SIGAO_RULE}

請只輸出 JSON，不要加 Markdown 說明。格式如下：
{
  "searchSummary": "館員檢索概述（簡要說明在自訂庫中找到的幾處對應文獻核心定位）",
  "citations": [
    {
      "documentId": "對應文件的ID",
      "documentTitle": "文件標題",
      "exactQuote": "原文直接精確引句（保持原文用字）",
      "sectionLocator": "章節/段落/條目編號（例如：第28條、第三章第4節）",
      "contextSnippet": "引文周邊上下文脈摘錄（2-4句話，協助理解背景）",
      "relevanceSummary": "館員索引備註（簡要指明此段落與檢索問題的對應關係）",
      "catecheticalTheme": "所屬教理範疇（如：信條、聖事、倫理十誡、基督徒祈禱、聖經章節）"
    }
  ]
}
若自訂文件中完全沒有任何相關資料，請在 citations 中回傳空陣列 []，並在 searchSummary 說明文件庫中未查找到相符文段，並建議讀者切換至「網際網路延伸檢索方案」。`;

const WEB_INSTRUCTIONS = `你是一位專業的「全球天主教教理與教會文獻參考館員」（Catholic & Ecclesiastical Reference Librarian）。
【最高使命與原則】：
1. 你必須使用網際網路搜尋，查閱外部權威教會文獻（天主教教理 Catechism of the Catholic Church、梵蒂岡宗座公報與教宗通諭、思高聖經新舊約、天主教法典、禮儀文獻）。
2. 【絕對禁令】：絕不寫教案、絕不撰寫教學流程、絕不發揮個人講道心得。
3. 只列出實際搜尋到的權威條目、經文章節、正式引文、文獻標題與出處網址。
4. 請以繁體中文撰寫，並使用標準天主教譯名。
5. ${SIGAO_RULE}
6. 每一項都要附上你這次搜尋真正打開過的 https 出處，用 Markdown 連結寫出。不要編造網址。`;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 50 * 1024 * 1024) {
    throw new PoeError("上傳內容超過 50MB 上限。", 413);
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PoeError("請求內容必須是 JSON 物件。", 400);
  }
  return body as Record<string, unknown>;
}

function modelName(env: Env): string {
  return env.MODEL?.trim() || DEFAULT_MODEL;
}

function webSearchModel(env: Env): string {
  return env.WEB_SEARCH_MODEL?.trim() || DEFAULT_WEB_SEARCH_MODEL;
}

function visionModel(env: Env): string {
  return env.VISION_MODEL?.trim() || modelName(env);
}

function decodeArchive(): Uint8Array | null {
  if (!archiveBase64) return null;
  const binary = atob(archiveBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function downloadPackage(): Response {
  const bytes = decodeArchive();
  if (!bytes) {
    return json({ error: "專案打包檔不存在，請先執行 npm run build 進行打包。" }, 404);
  }
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="catechesis-reference-search.zip"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function searchCustom(request: Request, env: Env): Promise<Response> {
  const body = await readBody(request);
  const query = body.query;
  const documents = body.documents;

  if (!query || typeof query !== "string") {
    return json({ error: "搜尋關鍵字或問題不能為空" }, 400);
  }
  if (!Array.isArray(documents) || documents.length === 0) {
    return json({ error: "自訂資料庫目前沒有文件，請先上載文件或使用預載教理文獻。" }, 400);
  }

  const library = documents.filter((doc): doc is LibraryDocument => {
    return Boolean(doc) && typeof doc === "object" && typeof (doc as LibraryDocument).id === "string";
  });

  const docContexts = library
    .map((doc, index) => {
      const preview = doc.content ? doc.content.slice(0, 15000) : "";
      return `【文件 ${index + 1}】
ID: ${doc.id}
標題: ${doc.title}
類別: ${doc.category || "教理講授資料"}
來源備註: ${doc.sourceMeta || "使用者上載"}
內容:
${preview}
`;
    })
    .join("\n====================\n");

  const prompt = `使用者檢索問題/關鍵字：\n「${query}」\n\n自訂上載資料庫文件庫內容如下：\n${docContexts}\n\n請以純 JSON 格式傳回館員檢索卡清單：`;

  let parsed: { searchSummary?: string; citations?: unknown } | null = null;
  try {
    const response = await poeChat(env.POE_API_KEY, {
      model: modelName(env),
      temperature: 0.1,
      messages: [
        { role: "system", content: CUSTOM_SYSTEM },
        { role: "user", content: prompt },
      ],
    });
    parsed = parseJsonFromModel(chatText(response)) as { searchSummary?: string; citations?: unknown };
  } catch (error) {
    if (error instanceof PoeError && (error.status === 401 || error.status === 402 || error.status === 503)) {
      throw error;
    }
    const fallbackCitations = lexicalExtractCitations(query, library);
    parsed = {
      searchSummary:
        fallbackCitations.length > 0
          ? `已由館員文獻索引系統在自訂庫中檢索出 ${fallbackCitations.length} 處相符之文獻章節。`
          : "自訂資料庫中未檢索到明確相符的字句，建議擴大檢索關鍵字或參考網際網路文獻方案。",
      citations: fallbackCitations,
    };
  }

  const citations = Array.isArray(parsed?.citations) ? parsed.citations : [];
  return json({
    sourceType: "custom",
    query,
    summary: parsed?.searchSummary || "",
    citations,
    totalMatches: citations.length,
    timestamp: new Date().toISOString(),
  });
}

function webPrompt(query: string): string {
  return `請以參考館員的身分，針對教理講授者提出的以下問題，用網際網路搜尋權威天主教文獻與思高聖經資源，並只引用你實際查到的出處：
檢索詞：『${query}』

請列出：
1. 檢索簡報（簡要說明在教會官方文獻或聖經中的定位）
2. 尋獲之核心文獻引用卡（包含：文獻名稱、條號/章節、精確核心引句、文脈說明、權威出處網址）
請不要撰寫任何教案或講道內容。
${SIGAO_RULE}

在報告正文使用 Markdown 連結標出實際網址。報告最後另起一行，只輸出這次真正引用的來源，格式必須是：
CITATIONS_JSON: [{"title":"文獻名稱","uri":"https://實際出處"}]`;
}

async function searchWeb(request: Request, env: Env): Promise<Response> {
  const body = await readBody(request);
  const query = body.query;
  if (!query || typeof query !== "string") {
    return json({ error: "搜尋關鍵字或問題不能為空" }, 400);
  }

  const prompt = webPrompt(query);
  let report = "";
  let sources: WebSource[] = [];

  try {
    let response: unknown;
    try {
      response = await poeChat(env.POE_API_KEY, {
        model: webSearchModel(env),
        temperature: 0.2,
        messages: [
          { role: "system", content: WEB_INSTRUCTIONS },
          { role: "user", content: prompt },
        ],
      });
    } catch (error) {
      if (!(error instanceof PoeError) || error.status !== 400) throw error;
      response = await poeChat(env.POE_API_KEY, {
        model: webSearchModel(env),
        temperature: 0.2,
        messages: [{ role: "user", content: `${WEB_INSTRUCTIONS}\n\n${prompt}` }],
      });
    }
    const split = splitReportAndSources(chatText(response), response);
    report = split.report;
    sources = split.sources;
  } catch (error) {
    if (error instanceof PoeError && (error.status === 401 || error.status === 402 || error.status === 503)) {
      throw error;
    }
    try {
      const response = await poeWebSearchResponse(env.POE_API_KEY, modelName(env), WEB_INSTRUCTIONS, prompt);
      const split = splitReportAndSources(responsesText(response), response);
      report = split.report;
      sources = split.sources;
    } catch (fallbackError) {
      if (fallbackError instanceof PoeError && (fallbackError.status === 401 || fallbackError.status === 402 || fallbackError.status === 503)) {
        throw fallbackError;
      }
      report = `【館員文獻索引指引】\n針對檢索關鍵字「${query}」，即時網搜暫時未能完成。推薦您直接查閱以下天主教權威教會文獻索引：\n\n1. 《天主教教理》（Catechism of the Catholic Church）相關條目定位\n2. 思高聖經新舊約對應章節經文\n3. 梵二大公會議《教會憲章》(Lumen Gentium) 與宗座通諭\n\n您可隨時切換至「方案一：自訂資料庫」直接檢索現有已載入的完整文獻。`;
      sources = CANONICAL_SOURCES;
    }
  }

  if (!report) report = "檢索已完成。";

  return json({
    sourceType: "web",
    query,
    librarianReport: report,
    sources,
    timestamp: new Date().toISOString(),
  });
}

async function describeDocument(env: Env, textContent: string, fileName: string) {
  let cleanTitle = fileName.replace(/\.[^/.]+$/, "");
  let category = classifyDocumentContent(cleanTitle, textContent);
  try {
    const categorizeRes = await poeChat(env.POE_API_KEY, {
      model: modelName(env),
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: `請檢視以下天主教文獻內容前 1000 字，判斷最適當的教理分類（只能從以下 6 個類別選 1 個最符合者：
1. 信德信條（天主、基督、三位一體、創世）
2. 禮儀聖事（聖洗、感恩聖祭、和好、堅振、婚配等）
3. 基督徒倫理（十誡、真福八端、愛德、社會訓導）
4. 基督徒祈禱（主禱文、默想、個人與團體祈禱）
5. 聖經經文與註釋（舊約、新約、福音選讀）
6. 教會訓導文獻（大公會議文獻、通諭、宗座文告））。
${SIGAO_RULE}
只回傳 JSON: {"category": "選定的類別", "suggestedTitle": "精簡文獻正名"}

文件內容片段：
${textContent.slice(0, 1000)}`,
        },
      ],
    });
    const catJson = parseJsonFromModel(chatText(categorizeRes)) as {
      category?: string;
      suggestedTitle?: string;
    };
    if (catJson.category) category = catJson.category;
    if (catJson.suggestedTitle && catJson.suggestedTitle.length > 2) {
      cleanTitle = catJson.suggestedTitle;
    }
  } catch {
    // Keep the rule-based category when the model is unavailable.
  }
  return { cleanTitle, category };
}

async function processFile(request: Request, env: Env): Promise<Response> {
  const body = await readBody(request);
  const fileName = body.fileName;
  const fileType = typeof body.fileType === "string" ? body.fileType : "";
  const rawContent = body.rawContent;
  const base64Data = body.base64Data;

  if (!fileName || typeof fileName !== "string") {
    return json({ error: "檔案名稱不能為空" }, 400);
  }

  let textContent = "";

  if (rawContent && typeof rawContent === "string") {
    textContent = rawContent;
  } else if (typeof base64Data === "string" && base64Data && fileType === "application/pdf") {
    try {
      const pdfResponse = await poeChat(env.POE_API_KEY, {
        model: modelName(env),
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `請將這份天主教教理/神學/聖經文獻檔案中的文字完整提取出來，並保留章節小節標題與條目編號。不需要添加任何額外評論，直接輸出整理好的文獻純文字內容。${SIGAO_RULE}`,
              },
              {
                type: "file",
                file: {
                  filename: fileName,
                  file_data: `data:application/pdf;base64,${base64Data}`,
                },
              },
            ],
          },
        ],
      });
      textContent = chatText(pdfResponse);
    } catch (error) {
      if (error instanceof PoeError && (error.status === 401 || error.status === 402 || error.status === 503)) {
        throw error;
      }
      return json(
        {
          error:
            "PDF 自動文字光學識別暫時受模型限制。建議您開啟 PDF 文件複製文字，並切換至「手動輸入 / 貼上文獻」分頁直接存入，或改為上傳 .txt 或 .md 檔案。",
        },
        400,
      );
    }
  } else if (
    typeof base64Data === "string" &&
    base64Data &&
    (fileType.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(fileName))
  ) {
    const mimeType = fileType.startsWith("image/")
      ? fileType
      : fileName.endsWith(".png")
        ? "image/png"
        : fileName.endsWith(".webp")
          ? "image/webp"
          : "image/jpeg";
    try {
      const imageResponse = await poeChat(env.POE_API_KEY, {
        model: modelName(env),
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `這是一張天主教聖經故事插圖、主日福音圖卡或教理教材視覺圖（來自聖經故事插圖動畫工作室）。
請仔細閱讀圖片中的畫面與文字，並以結構化純文字整理輸出，供參考館員建立引句索引：
1. 【插圖主題與聖經出處】：指出相應的主日或聖經經文章節（例如：若望福音 6:1-15、甲年常年期第17主日等）
2. 【圖中文字解說】：完整提取圖片中出現的所有解說文字、對白、經文標注或旁白（一字不漏）
3. 【插圖畫面描繪與教理情境】：以客觀參考館員語調，簡述插圖描繪的聖經人物動作與場景情境（例如：耶穌伸手平息風浪，小船在狂風怒濤中，門徒面帶驚慌呼求主），以便檢索時能根據畫面情節精準命中
4. 【核心教理主題標籤】：如 聖體聖事、憐憫與信德、基督天主性 等
${SIGAO_RULE}
請直接輸出整理後的純文字，格式清晰整潔。`,
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Data}` },
              },
            ],
          },
        ],
      });
      textContent = chatText(imageResponse);
    } catch (error) {
      if (error instanceof PoeError && (error.status === 401 || error.status === 402 || error.status === 503)) {
        throw error;
      }
      return json(
        {
          error:
            "圖片文字與畫面解說解析暫時受限制。建議您切換至「手動輸入 / 貼上文獻」分頁，直接將該福音圖的文字解說存入，或改傳 .txt / .md 檔案。",
        },
        400,
      );
    }
  } else {
    return json({ error: "請提供有效的文字、PDF 或圖片檔案內容" }, 400);
  }

  if (!textContent.trim()) {
    return json({ error: "未能從檔案抽出文字內容。" }, 400);
  }

  const { cleanTitle, category } = await describeDocument(env, textContent, fileName);
  return json({
    title: cleanTitle,
    category,
    content: textContent,
    wordCount: textContent.length,
    uploadedAt: new Date().toISOString(),
  });
}

async function ocrPages(request: Request, env: Env): Promise<Response> {
  const body = await readBody(request);
  let pages;
  try {
    pages = parseOcrPages(body.pages);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "掃描頁請求無效" }, 400);
  }
  const fileName = typeof body.fileName === "string" && body.fileName.trim() ? body.fileName.trim() : "掃描頁";
  const listed = pages.map((page) => page.page).join("、");
  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `以下圖片是天主教教材 PDF「${fileName}」的掃描頁，頁碼依次是：${listed}。
請逐頁照印刷原文謄錄，保留標題、條號、換行與標點。
每一頁先單獨寫一行「【第N頁】」，N 必須用我提供的頁碼。
不要寫評論、不要翻譯、不要把頁上的天主教用字改成基督教和合本。
若某頁幾乎沒有文字，該頁只寫「【第N頁】」並加上「（本頁無可辨識文字）」。
${SIGAO_RULE}`,
    },
  ];
  for (const page of pages) {
    content.push({ type: "text", text: `下一張圖是第 ${page.page} 頁。` });
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${page.imageBase64}` },
    });
  }

  const response = await poeChat(env.POE_API_KEY, {
    model: visionModel(env),
    temperature: 0,
    messages: [{ role: "user", content }],
  });
  const transcript = splitOcrTranscript(chatText(response), pages.map((page) => page.page));
  return json({ pages: transcript });
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return json({ status: "ok" });
  }
  if (request.method === "GET" && url.pathname === "/api/download-package") {
    return downloadPackage();
  }
  if (request.method === "POST" && url.pathname === "/api/search/custom") {
    return searchCustom(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/search/web") {
    return searchWeb(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/process-file") {
    return processFile(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/ocr-pages") {
    return ocrPages(request, env);
  }
  return json({ error: "找不到此 API。" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (error) {
        console.error("API error", publicPoeError(error));
        const status = error instanceof PoeError ? error.status : 500;
        return json({ error: publicPoeError(error) || "伺服器發生錯誤，請稍後再試。" }, status);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
