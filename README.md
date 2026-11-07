# 天主教教理講授資料搜尋器 (Catechesis Reference Search)

這是一個專為天主教教理講授員、傳道員、神父、執事及牧靈工作者設計的權威教理與聖經引句搜尋器。

系統以「教會圖書館參考館員」定位：在自訂與預載文獻中抽出原文引句、章節與出處，並以 Poe 的 OpenAI 相容 API 做網際網路檢索。聖經引文要求沿用《思高聖經》用字（天主、聖神、瑪竇、馬爾谷、路加、若望），不改寫成和合本。

正式環境部署在 **Cloudflare Workers**。前端 `vite build` 的 `dist/` 才是公開靜態資源；Worker 原始碼與 `POE_API_KEY` 不會放進靜態目錄。

---

## 核心功能

1. **雙方案對照**：自訂／預載文獻庫，與 Poe `Web-Search` 網際網路檢索並列。
2. **預載文獻**：天主教教理四部分、思高本路加福音第十五章、梵二《教會憲章》。全部保留在 `src/data/sampleCatechism.ts`。
3. **自訂資料庫**：PDF、TXT、Markdown、CSV、JSON 與福音插圖（PNG、JPG、WebP）上載、自動分類，IndexedDB／本機儲存。
4. **待細閱清單**與引用複製。
5. **`/api/download-package`**：下載不含金鑰的專案原始碼 zip（建置時封進 Worker，不當成公開靜態檔）。

---

## Cloudflare 控制台設定

以 GitHub 連接此儲存庫後，在 Workers Builds 使用：

| 項目 | 值 |
| --- | --- |
| 建置指令 Build command | `npm run build` |
| 部署指令 Deploy command | `npx wrangler deploy` |
| 秘密 Secret 名稱 | `POE_API_KEY`（Encrypt，不要寫進 wrangler 變數或前端） |
| 純文字變數（已寫在 `wrangler.jsonc`，可在控制台覆寫） | `MODEL` 預設 `Claude-Haiku-5.5`；`WEB_SEARCH_MODEL` 預設 `Web-Search` |

`POE_API_KEY` 請到 [poe.com/api/keys](https://poe.com/api/keys) 建立。每次 `npx wrangler deploy` 會套用 `wrangler.jsonc` 的 `MODEL` 與 `WEB_SEARCH_MODEL`。

Poe 文件：

- Chat Completions：`POST https://api.poe.com/v1/chat/completions`（[說明](https://creator.poe.com/docs/external-applications/openai-compatible-api)）
- 模型欄位使用 Poe bot 名稱。預設文獻／PDF／圖片模型為 `Claude-Haiku-5.5`。
- 網搜模式使用 Poe 官方會把網搜路由過去的 **`Web-Search`** bot，並從回應的連結、`citations`，以及（備援時）Responses API 的 `web_search_call.action.sources` 取出引用。Responses API 的內建網搜工具見同一份文件的 Web Search 一節與 [`include`](https://creator.poe.com/api-reference/createResponse)。

---

## 本機

需要 Node.js 20+。

```bash
npm install
cp .dev.vars.example .dev.vars
# 編輯 .dev.vars，填入 POE_API_KEY
npm run dev
```

驗證：

```bash
npm test
npm run build
npx wrangler deploy --dry-run
```

---

## 專案結構

```text
├── worker/                # Cloudflare Worker（API；不會放進 dist）
├── src/                   # React 前端與預載教理文獻
├── wrangler.jsonc         # 靜態資源只指向 dist；不含 API 金鑰
├── scripts/package.mjs    # 把不含密鑰的源碼 zip 嵌進 Worker
└── package.json
```
