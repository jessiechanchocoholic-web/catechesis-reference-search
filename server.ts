import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// Primary and fallback models according to Gemini API guidance
const PRIMARY_MODEL = "gemini-3.1-flash-lite";
const SECONDARY_MODEL = "gemini-3.8-flash";

// Helper for calling Gemini with retry on temporary 503 / network errors
async function callWithRetry<T>(fn: (modelName: string) => Promise<T>, retries = 2, delayMs = 600): Promise<T> {
  const models = [PRIMARY_MODEL, SECONDARY_MODEL];

  for (let attempt = 0; attempt < retries; attempt++) {
    const currentModel = models[attempt % models.length];
    try {
      return await fn(currentModel);
    } catch (err: any) {
      const errMsg = err?.message || String(err);

      // If quota exhaustion (429 RESOURCE_EXHAUSTED), try alternate model if available
      if (errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Quota exceeded") || errMsg.includes("429")) {
        if (attempt + 1 < retries) {
          continue;
        }
        throw err;
      }

      // If temporary 503 unavailable, retry with short delay
      if (errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand")) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 1.5;
        continue;
      }

      throw err;
    }
  }
  throw new Error("模型服務連線超時，請稍後再試。");
}

// Rule-based classifier for Catholic documents
function classifyDocumentContent(title: string, content: string): string {
  const text = (title + " " + content.slice(0, 3000)).toLowerCase();
  if (/信德|信條|天主|創世|三位一體|復活|救恩|降生成人|原罪/.test(text)) return "信德信條";
  if (/聖事|感恩|聖體|洗禮|聖洗|堅振|告解|和好|婚配|聖秩|傅油|禮儀|彌撒|實質轉變/.test(text)) return "禮儀聖事";
  if (/倫理|十誡|誡命|真福|愛德|道德|社會訓導|良心|罪過/.test(text)) return "基督徒倫理";
  if (/祈禱|天主經|主禱文|默想|默觀|念珠|玫瑰經|日課|達瑪森/.test(text)) return "基督徒祈禱";
  if (/聖經|福音|新約|舊約|宗徒|瑪竇|馬爾谷|路加|若望|格林多|羅馬書|伯多祿|保祿|撒瑪黎雅/.test(text)) return "聖經經文與註釋";
  if (/通諭|大公會議|梵二|憲章|宗座|訓導|法典|教會憲章/.test(text)) return "教會訓導文獻";
  return "堂區講義與教案筆記";
}

// Fallback lexical librarian extractor if Gemini experiences temporary service spikes
function lexicalExtractCitations(query: string, documents: any[]): any[] {
  const keywords = query
    .toLowerCase()
    .split(/[\s,，、。！？；;「」『』\(\)]+/)
    .filter((k) => k.length >= 2);

  if (keywords.length === 0) return [];

  const matchedItems: Array<{
    doc: any;
    quote: string;
    locator: string;
    context: string;
    score: number;
    matchedWords: string[];
  }> = [];

  for (const doc of documents) {
    if (!doc.content) continue;
    // Split into meaningful paragraphs or articles
    const rawParagraphs = doc.content.split(/\n\s*\n/);
    const paragraphs = rawParagraphs.length > 1 ? rawParagraphs : doc.content.split("\n");

    let currentSection = doc.title || "教理文獻選段";

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      if (!paragraph) continue;

      // Detect chapter/article headers
      const headerMatch = paragraph.match(/(第[0-9一二三四五六七八九十百千]+[條章節篇]|【[^】]+】|CCC\s*[0-9]+|[0-9]+:[0-9]+(-[0-9]+)?)/i);
      if (headerMatch) {
        currentSection = headerMatch[0];
      }

      // Count keyword occurrences
      const matchedWords: string[] = [];
      let score = 0;
      for (const kw of keywords) {
        if (paragraph.toLowerCase().includes(kw)) {
          matchedWords.push(kw);
          score += 1;
        }
      }

      if (score > 0) {
        // Extract the most representative sentence
        const sentences = paragraph.split(/(?<=[。！？\n])/);
        const bestSentence = sentences.find((s) => matchedWords.some((kw) => s.toLowerCase().includes(kw))) || sentences[0];

        matchedItems.push({
          doc,
          quote: bestSentence.trim().slice(0, 250),
          locator: currentSection,
          context: paragraph.slice(0, 300),
          score,
          matchedWords,
        });
      }
    }
  }

  // Sort by score descending and pick top 6
  matchedItems.sort((a, b) => b.score - a.score);
  const topMatches = matchedItems.slice(0, 6);

  return topMatches.map((item) => ({
    documentId: item.doc.id,
    documentTitle: item.doc.title,
    exactQuote: item.quote,
    sectionLocator: item.locator,
    contextSnippet: item.context,
    relevanceSummary: `館員依關鍵字「${item.matchedWords.join("、")}」定位於此段落，與檢索內容高度相應。`,
    catecheticalTheme: item.doc.category || classifyDocumentContent(item.doc.title, item.context),
  }));
}

// Health Check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Search within custom uploaded documents (方案一：自訂文件資料庫檢索)
app.post("/api/search/custom", async (req, res) => {
  try {
    const { query, documents } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "搜尋關鍵字或問題不能為空" });
    }

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ 
        error: "自訂資料庫目前沒有文件，請先上載文件或使用預載教理文獻。" 
      });
    }

    const ai = getGeminiClient();

    // Prepare document library context for Gemini
    const docContexts = documents.map((doc, idx) => {
      // truncate per doc if extremely long to fit prompt context comfortably
      const preview = doc.content ? doc.content.slice(0, 15000) : "";
      return `【文件 ${idx + 1}】
ID: ${doc.id}
標題: ${doc.title}
類別: ${doc.category || "教理講授資料"}
來源備註: ${doc.sourceMeta || "使用者上載"}
內容:
${preview}
`;
    }).join("\n====================\n");

    const systemInstruction = `你是一位專業、嚴謹的「天主教教理講授資料庫參考館員」（Theological & Catechetical Reference Librarian）。
【最高使命與原則】：
1. 使用者是資深的教理講授員或牧民工作者，他們只需要你像圖書館員一樣，依據讀者所提出的問題或關鍵字，在他們「已上載的自訂文件庫」中尋找並定位相關文獻資料。
2. 【絕對禁令】：絕不撰寫教案、絕不撰寫講道辭、絕不設計課堂活動或問答題、絕不自行增添說教或主觀抒情。
3. 你的任務純粹是：查找資料、精確引文、標註段落章節出處、提供前後文脈，以便使用者之後親自細閱並自行處理。
4. 所有引用必須忠於提供的自訂文件內容，不得憑空捏造文件中不存在的字句。
5. 請以繁體中文（台灣/香港常用之天主教牧民與教理名詞，如「天主、聖神、聖體、彌撒、告解、福音」）輸出。

請以嚴格的 JSON 格式輸出搜尋結果，格式如下：
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

    const prompt = `使用者檢索問題/關鍵字：\n「${query}」\n\n自訂上載資料庫文件庫內容如下：\n${docContexts}\n\n請以純 JSON 格式傳回館員檢索卡清單：`;

    let parsed: any = null;

    try {
      const response = await callWithRetry((modelName) =>
        ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        })
      );

      const responseText = response.text || "{}";
      parsed = JSON.parse(responseText);
    } catch {
      const fallbackCitations = lexicalExtractCitations(query, documents);
      parsed = {
        searchSummary: fallbackCitations.length > 0 
          ? `已由館員文獻索引系統在自訂庫中檢索出 ${fallbackCitations.length} 處相符之文獻章節。`
          : "自訂資料庫中未檢索到明確相符的字句，建議擴大檢索關鍵字或參考網際網路文獻方案。",
        citations: fallbackCitations,
      };
    }

    return res.json({
      sourceType: "custom",
      query,
      summary: parsed?.searchSummary || "",
      citations: Array.isArray(parsed?.citations) ? parsed.citations : [],
      totalMatches: Array.isArray(parsed?.citations) ? parsed.citations.length : 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Custom search error:", error);
    return res.status(500).json({
      error: error.message || "自訂資料庫檢索時發生錯誤，請稍後再試。",
    });
  }
});

// Search Internet Catholic & Theological Resources using Google Search Grounding (方案二：網際網路延伸檢索)
app.post("/api/search/web", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "搜尋關鍵字或問題不能為空" });
    }

    const ai = getGeminiClient();

    const systemInstruction = `你是一位專業的「全球天主教教理與教會文獻參考館員」（Catholic & Ecclesiastical Reference Librarian）。
【最高使命與原則】：
1. 你的職責是利用網際網路檢索功能，幫助教理講授員查閱外部權威教會文獻（如：天主教教理 Catechism of the Catholic Church、梵蒂岡宗座公報與教宗通諭文告、思高聖經新舊約經文、天主教法典、歷任教宗文獻、禮儀聖事部憲章等）。
2. 【絕對禁令】：絕不寫教案、絕不撰寫教學流程、絕不發揮個人講道心得。你是一位客觀、精確的圖書資訊館員。
3. 你的任務純粹是列出在網際網路上尋獲的「權威教會條目、經文章節、正式引文、文獻標題、條號或出處」，以便使用者自己細讀。
4. 請以繁體中文撰寫，並使用標準天主教譯名（天主、聖母、聖神、宗徒、厄瑪奴耳等）。
5. 必須為每一項檢索結果提供清楚的文獻名稱、編號（如 CCC 條號、福音章節）、確切引言與資料來源標籤。`;

    const prompt = `請以參考館員的身分，針對教理講授者提出的以下問題，在網際網路權威天主教文獻與聖經資源庫中進行查證與文獻檢索：
檢索詞：『${query}』

請列出：
1. 檢索簡報（簡要說明在教會官方文獻或聖經中的定位）
2. 尋獲之核心文獻引用卡（包含：文獻名稱、條號/章節、精確核心引句、文脈說明、權威出處網址/機構如梵蒂岡教廷或思高聖經會等）
請不要撰寫任何教案或講道內容。`;

    let librarianText = "";
    const canonicalCatholicSources = [
      { uri: "https://www.vatican.va/archive/ENG0015/_INDEX.HTM", title: "梵蒂岡宗座聖座《天主教教理》(CCC) 官方全文庫" },
      { uri: "https://www.ccreadv.com", title: "思高聖經學會經文及註釋檢索庫 (SBF)" },
      { uri: "https://www.vatican.va/content/vatican/zh.html", title: "梵蒂岡宗座聖座官方中文文獻庫" },
      { uri: "https://www.catholic.org.tw", title: "天主教台灣地區主教團權威文獻專區" },
    ];
    let uniqueSources = [...canonicalCatholicSources];

    // Check if Google Search Grounding is explicitly enabled via environment variable
    const enableSearchGrounding = process.env.ENABLE_GOOGLE_SEARCH_GROUNDING === "true";

    if (enableSearchGrounding) {
      try {
        const groundedRes = await ai.models.generateContent({
          model: PRIMARY_MODEL,
          contents: prompt,
          config: {
            systemInstruction,
            tools: [{ googleSearch: {} }],
            temperature: 0.2,
          },
        });

        if (groundedRes.text) {
          librarianText = groundedRes.text;
          const rawChunks = groundedRes.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          const webSources = rawChunks
            .filter((chunk: any) => chunk.web && chunk.web.uri)
            .map((chunk: any) => ({
              uri: chunk.web.uri,
              title: chunk.web.title || chunk.web.uri,
            }));
          if (webSources.length > 0) {
            uniqueSources = Array.from(
              new Map([...webSources, ...canonicalCatholicSources].map((item: any) => [item.uri, item])).values()
            );
          }
        }
      } catch {
        // Silently proceed to direct theological librarian generation
      }
    }

    // Default & reliable path: Direct theological reference librarian generation
    if (!librarianText) {
      try {
        const response = await callWithRetry((modelName) =>
          ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: systemInstruction + "\n請在文獻引用卡中註明標準官方出處（如：梵蒂岡官網 vatican.va、思高聖經網站 ccreadv.com 或天主教教理綱要 CCC 編號與條目）。",
              temperature: 0.2,
            },
          }),
          2,
          500
        );

        librarianText = response.text || "檢索已完成。";
      } catch {
        // Graceful theological indexing response if model is temporarily unavailable
        librarianText = `【館員文獻索引指引】\n針對檢索關鍵字「${query}」，推薦您查閱以下天主教權威教會文獻索引：\n\n1. 《天主教教理》（Catechism of the Catholic Church）相關條目定位\n2. 思高聖經新舊約對應章節經文\n3. 梵二大公會議《教會憲章》(Lumen Gentium) 與宗座通諭\n\n您可隨時切換至「方案一：自訂資料庫」直接檢索現有已載入的完整文獻。`;
      }
    }

    return res.json({
      sourceType: "web",
      query,
      librarianReport: librarianText,
      sources: uniqueSources,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Web search error:", error);
    return res.status(500).json({
      error: error.message || "網際網路延伸檢索時發生錯誤，請稍後再試。",
    });
  }
});

// Process uploaded document (Text or Base64 / PDF extraction)
app.post("/api/process-file", async (req, res) => {
  try {
    const { fileName, fileType, rawContent, base64Data } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: "檔案名稱不能為空" });
    }

    let textContent = "";

    if (rawContent && typeof rawContent === "string") {
      textContent = rawContent;
    } else if (base64Data && fileType === "application/pdf") {
      // Use Gemini to extract text and structure from PDF
      try {
        const ai = getGeminiClient();
        const pdfPart = {
          inlineData: {
            mimeType: "application/pdf",
            data: base64Data,
          },
        };
        const textPrompt = {
          text: "請將這份天主教教理/神學/聖經文獻檔案中的文字完整提取出來，並保留章節小節標題與條目編號。不需要添加任何額外評論，直接輸出整理好的文獻純文字內容。",
        };

        const pdfResponse = await callWithRetry((modelName) =>
          ai.models.generateContent({
            model: modelName,
            contents: { parts: [pdfPart, textPrompt] },
          }),
          2,
          800
        );

        textContent = pdfResponse.text || "";
      } catch {
        return res.status(400).json({
          error: "PDF 自動文字光學識別暫時受模型配額限制。建議您開啟 PDF 文件複製文字，並切換至「手動輸入 / 貼上文獻」分頁直接存入，或改為上傳 .txt 或 .md 檔案。",
        });
      }
    } else if (
      base64Data &&
      (fileType?.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(fileName))
    ) {
      // Extract text, scripture citations, and scene description from Gospel illustrations/images
      const mimeType = fileType?.startsWith("image/")
        ? fileType
        : fileName.endsWith(".png")
        ? "image/png"
        : fileName.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

      try {
        const ai = getGeminiClient();
        const imagePart = {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        };
        const textPrompt = {
          text: `這是一張天主教聖經故事插圖、主日福音圖卡或教理教材視覺圖（來自聖經故事插圖動畫工作室）。
請仔細閱讀圖片中的畫面與文字，並以結構化純文字整理輸出，供參考館員建立引句索引：
1. 【插圖主題與聖經出處】：指出相應的主日或聖經經文章節（例如：若望福音 6:1-15、甲年常年期第17主日等）
2. 【圖中文字解說】：完整提取圖片中出現的所有解說文字、對白、經文標注或旁白（一字不漏）
3. 【插圖畫面描繪與教理情境】：以客觀參考館員語調，簡述插圖描繪的聖經人物動作與場景情境（例如：耶穌伸手平息風浪，小船在狂風怒濤中，門徒面帶驚慌呼求主），以便檢索時能根據畫面情節精準命中
4. 【核心教理主題標籤】：如 聖體聖事、憐憫與信德、基督天主性 等

請直接輸出整理後的純文字，格式清晰整潔。`,
        };

        const imageResponse = await callWithRetry((modelName) =>
          ai.models.generateContent({
            model: modelName,
            contents: { parts: [imagePart, textPrompt] },
          }),
          2,
          800
        );

        textContent = imageResponse.text || "";
      } catch {
        return res.status(400).json({
          error: "圖片文字與畫面解說解析暫時受限制。建議您切換至「手動輸入 / 貼上文獻」分頁，直接將該福音圖的文字解說存入，或改傳 .txt / .md 檔案。",
        });
      }
    } else {
      return res.status(400).json({ error: "請提供有效的文字、PDF 或圖片檔案內容" });
    }

    // Default categorization using rule-based classifier (instant & zero quota consumption)
    let cleanTitle = fileName.replace(/\.[^/.]+$/, "");
    let category = classifyDocumentContent(cleanTitle, textContent);

    // Optionally refine with AI categorization if available
    try {
      const ai = getGeminiClient();
      const categorizeRes = await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents: `請檢視以下天主教文獻內容前 1000 字，判斷最適當的教理分類（只能從以下 6 個類別選 1 個最符合者：
1. 信德信條（天主、基督、三位一體、創世）
2. 禮儀聖事（聖洗、感恩聖祭、和好、堅振、婚配等）
3. 基督徒倫理（十誡、真福八端、愛德、社會訓導）
4. 基督徒祈禱（主禱文、默想、個人與團體祈禱）
5. 聖經經文與註釋（舊約、新約、福音選讀）
6. 教會訓導文獻（大公會議文獻、通諭、宗座文告））。
回傳格式為 JSON: {"category": "選定的類別", "suggestedTitle": "精簡文獻正名"}

文件內容片段：
${textContent.slice(0, 1000)}`,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      const catJson = JSON.parse(categorizeRes.text || "{}");
      if (catJson.category) category = catJson.category;
      if (catJson.suggestedTitle && catJson.suggestedTitle.length > 2) {
        cleanTitle = catJson.suggestedTitle;
      }
    } catch {
      // Keep rule-based category without error
    }

    const wordCount = textContent.length;

    return res.json({
      title: cleanTitle,
      category,
      content: textContent,
      wordCount,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Process file error:", error);
    return res.status(500).json({
      error: error.message || "處理文件時發生錯誤。",
    });
  }
});

// Download packaged source code zip
app.get("/api/download-package", (_req, res) => {
  const zipPath = path.join(process.cwd(), "public", "catechesis-reference-search.zip");
  if (fs.existsSync(zipPath)) {
    res.setHeader("Content-Disposition", 'attachment; filename="catechesis-reference-search.zip"');
    res.setHeader("Content-Type", "application/zip");
    const stream = fs.createReadStream(zipPath);
    stream.pipe(res);
  } else {
    res.status(404).json({ error: "專案打包檔不存在，請先執行 npm run package 進行打包。" });
  }
});

// Vite middleware & Static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`教理講授資料搜尋器 server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
