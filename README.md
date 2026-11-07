# 天主教教理講授資料搜尋器 (Catechesis Reference Search)

這是一個專為天主教教理講授員、傳道員、神父、執事及牧靈工作者設計的權威教理與聖經引句搜尋器。

系統採用客觀「教會圖書館參考館員」（Ecclesiastical Reference Librarian）定位架構，結合 **Google Gemini API** 多模態大語言模型，提供精確的教理條目定位、原文引句核對、多檔案批量文獻管理，以及聖經故事插圖動畫工作室主日福音圖視覺分析與引句索引。

---

## ✨ 核心功能

1. **三階檢索體系（Three-Tier Retrieval）**：
   - 第一階：優先自訂教理文獻庫（堂區講義、講章、主日學教材、工作室福音圖）。
   - 第二階：官方預載權威核心（天主教教理 CCC、思高聖經、梵二文獻、教會法典等）。
   - 第三階：全球公教資料庫聯檢（Vatican.va、CCReadBible、CNA 等）。
2. **多模態主日福音插圖辨識**：
   - 支援直接批量上載 `.png`, `.jpg`, `.webp` 福音插圖。
   - 自動 OCR 萃取圖中經文、解說文字與聖經章節標註。
   - 自動索引插圖畫面聖經人物動作與教理情境。
3. **多檔案批量文獻管理**：
   - 支援 PDF、TXT、Markdown、CSV、JSON 批次拖曳上傳與自動分類。
4. **離線與本機持久化**：
   - 內建 IndexedDB / 本機儲存，自訂文獻與書籤研讀清單不遺失。

---

## 🚀 快速開始（本機運行）

### 1. 環境需求
- **Node.js**: v18.0.0 或更高版本（建議 v20+）
- **npm** (或 pnpm / yarn / bun)
- **Google Gemini API Key**（可至 [Google AI Studio](https://aistudio.google.com/app/apikey) 免費申請）

### 2. 安裝依賴
```bash
npm install
```

### 3. 設定環境變數
複製 `.env.example` 為 `.env`：
```bash
cp .env.example .env
```
編輯 `.env` 並填入您的 Gemini API Key：
```env
GEMINI_API_KEY="AIzaSy..."
PORT=3000
```

### 4. 啟動開發伺服器
```bash
npm run dev
```
瀏覽器開啟：`http://localhost:3000`

---

## 📦 正式環境建置與運行 (Production)

### 構建與啟動
```bash
# 建置前端與後端
npm run build

# 啟動正式伺服器
npm start
```
伺服器將在 `http://localhost:3000` 運行。

---

## 🐳 Docker 容器化部署

本專案附帶標準 `Dockerfile`，可直接建置並運行：

```bash
# 建置 Docker 映像檔
docker build -t catechesis-search .

# 運行容器
docker run -d -p 3000:3000 \
  -e GEMINI_API_KEY="您的_GEMINI_API_KEY" \
  --name catechesis-app \
  catechesis-search
```

---

## ☁️ 雲端平台遷移與部署指南

### 1. Google Cloud Run
可以直接使用 Cloud Build 或 Docker 映像檔部署：
```bash
gcloud run deploy catechesis-search \
  --source . \
  --region asia-east1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY="您的_API_KEY"
```

### 2. Render / Railway / Fly.io
- 連接您的 Git 儲存庫（GitHub / GitLab）。
- 設定 Build Command: `npm install && npm run build`
- 設定 Start Command: `npm start`
- 在後台環境變數（Environment Variables）中添加 `GEMINI_API_KEY`。

### 3. VPS（Ubuntu / Debian 等虛擬主機）
使用 PM2 常駐進程管理：
```bash
# 全域安裝 pm2
npm install -g pm2

# 安裝依賴並編譯
npm install
npm run build

# 使用 pm2 啟動
pm2 start dist/server.cjs --name "catechesis-search"
pm2 save
pm2 startup
```

---

## 📂 專案結構簡介

```text
├── server.ts              # Express 後端：Gemini 搜尋代理、PDF/圖片 OCR、文件處理
├── src/
│   ├── App.tsx            # 主應用入口
│   ├── components/        # UI 元件 (搜尋列、自訂文獻管理、引句卡片、研讀清單等)
│   ├── services/          # API 調用、搜尋邏輯、IndexedDB 儲存服務
│   ├── data/              # 官方預載核心教理文獻
│   └── types.ts           # TypeScript 資料型別定義
├── public/                # 靜態資源
├── package.json           # 專案依賴與腳本
├── vite.config.ts         # Vite 建置設定
├── tsconfig.json          # TypeScript 設定
└── Dockerfile             # Docker 容器建置設定
```

---

## 📜 授權與宣告
本搜尋器以推廣聖經與天主教正統教理研讀為宗旨，所有引句均標註出處章節。自訂文獻與圖片儲存於使用者瀏覽器本機資料庫。
