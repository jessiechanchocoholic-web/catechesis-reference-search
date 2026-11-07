import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { SchemeSelector } from "./components/SchemeSelector";
import { SearchBar } from "./components/SearchBar";
import { CustomCitationCard, WebLibrarianReportCard } from "./components/CitationCard";
import { DocumentManagerModal } from "./components/DocumentManagerModal";
import { DocumentPreviewModal } from "./components/DocumentPreviewModal";
import { ReadingListDrawer } from "./components/ReadingListDrawer";
import {
  CatechismDocument,
  CustomSearchResponse,
  WebSearchResponse,
  SearchScheme,
  ReadingListItem,
} from "./types";
import {
  getStoredDocuments,
  saveDocument,
  saveDocumentsBatch,
  deleteDocument,
  deleteDocumentsBatch,
  resetToPresets,
  getReadingList,
  addToReadingList,
  removeFromReadingList,
  clearReadingList,
} from "./services/storage";
import {
  BookOpen,
  Database,
  Globe,
  Sparkles,
  AlertTriangle,
  FileText,
  FolderUp,
  Bookmark,
  CheckCircle2,
  Compass,
} from "lucide-react";

export default function App() {
  const [documents, setDocuments] = useState<CatechismDocument[]>([]);
  const [readingList, setReadingList] = useState<ReadingListItem[]>([]);
  const [currentScheme, setCurrentScheme] = useState<SearchScheme>("dual");

  // Search state
  const [currentQuery, setCurrentQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [customResult, setCustomResult] = useState<CustomSearchResponse | null>(null);
  const [webResult, setWebResult] = useState<WebSearchResponse | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Modals state
  const [isDocManagerOpen, setIsDocManagerOpen] = useState(false);
  const [isReadingListOpen, setIsReadingListOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<CatechismDocument | null>(null);

  // Initialize storage
  useEffect(() => {
    const loadedDocs = getStoredDocuments();
    setDocuments(loadedDocs);
    const loadedList = getReadingList();
    setReadingList(loadedList);
  }, []);

  // Document management handlers
  const handleAddDocument = (newDoc: CatechismDocument) => {
    const updated = saveDocument(newDoc);
    setDocuments(updated);
  };

  const handleBatchAddDocuments = (newDocs: CatechismDocument[]) => {
    const updated = saveDocumentsBatch(newDocs);
    setDocuments(updated);
  };

  const handleDeleteDocument = (id: string) => {
    const updated = deleteDocument(id);
    setDocuments(updated);
  };

  const handleBatchDeleteDocuments = (ids: string[]) => {
    const updated = deleteDocumentsBatch(ids);
    setDocuments(updated);
  };

  const handleResetPresets = () => {
    const restored = resetToPresets();
    setDocuments(restored);
  };

  // Reading list handlers
  const handleAddToReadingList = (item: {
    sourceType: "custom" | "web";
    sourceTitle: string;
    locator: string;
    quoteOrSnippet: string;
    context?: string;
    url?: string;
  }) => {
    const updated = addToReadingList(item);
    setReadingList(updated);
  };

  const handleRemoveReadingListItem = (id: string) => {
    const updated = removeFromReadingList(id);
    setReadingList(updated);
  };

  const handleClearReadingList = () => {
    const cleared = clearReadingList();
    setReadingList(cleared);
  };

  // Main search execution
  const handleSearch = async (query: string) => {
    if (!query.trim()) return;

    setCurrentQuery(query);
    setIsSearching(true);
    setSearchError(null);

    try {
      if (currentScheme === "dual") {
        // Execute both in parallel
        const [customPromise, webPromise] = await Promise.allSettled([
          fetch("/api/search/custom", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, documents }),
          }).then((res) => {
            if (!res.ok) throw new Error("自訂資料庫檢索未成功");
            return res.json();
          }),
          fetch("/api/search/web", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          }).then((res) => {
            if (!res.ok) throw new Error("網際網路文獻檢索未成功");
            return res.json();
          }),
        ]);

        if (customPromise.status === "fulfilled") {
          setCustomResult(customPromise.value);
        } else {
          setCustomResult({
            sourceType: "custom",
            query,
            summary: "檢索自訂資料庫時發生異常，請檢查資料庫文件。",
            citations: [],
            totalMatches: 0,
            timestamp: new Date().toISOString(),
          });
        }

        if (webPromise.status === "fulfilled") {
          setWebResult(webPromise.value);
        } else {
          setWebResult({
            sourceType: "web",
            query,
            librarianReport: "外部網際網路檢索暫時無法連通。",
            sources: [],
            timestamp: new Date().toISOString(),
          });
        }
      } else if (currentScheme === "custom") {
        const res = await fetch("/api/search/custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, documents }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "自訂資料庫檢索失敗");
        setCustomResult(data);
      } else if (currentScheme === "web") {
        const res = await fetch("/api/search/web", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "網際網路檢索失敗");
        setWebResult(data);
      }
    } catch (err: any) {
      console.error("Search failed:", err);
      setSearchError(err.message || "搜尋發生未預期的錯誤");
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenDocPreviewById = (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (doc) {
      setPreviewDoc(doc);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100/60 flex flex-col font-sans text-stone-900">
      {/* Top App Header */}
      <Header
        documentCount={documents.length}
        readingListCount={readingList.length}
        onOpenDocManager={() => setIsDocManagerOpen(true)}
        onOpenReadingList={() => setIsReadingListOpen(true)}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Search Bar */}
        <SearchBar onSearch={handleSearch} isLoading={isSearching} />

        {/* Search Scheme Switcher */}
        <SchemeSelector
          currentScheme={currentScheme}
          onSelectScheme={(s) => setCurrentScheme(s)}
          customDocCount={documents.length}
        />

        {/* Global Error Notice */}
        {searchError && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Empty State / Welcome Librarian Desk (Before first search) */}
        {!currentQuery && !isSearching && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-xs">
            <div className="max-w-2xl mx-auto text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto shadow-xs">
                <BookOpen className="w-7 h-7 text-amber-800" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-stone-900 font-serif">
                  教理講授資料庫 · 參考館員檢索台
                </h2>
                <p className="text-xs text-stone-600 mt-1 max-w-lg mx-auto leading-relaxed">
                  專為教理員與牧民工作者打造：以您上載的文獻庫為檢索根基，精準提供出處章節與引言定位，方便您後續細閱與親自備課。
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 font-serif">
                    <Database className="w-4 h-4 text-amber-700" />
                    <span>以自訂上載為根源</span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1 leading-normal">
                    優先於您上載的文獻庫檢索（現有 {documents.length} 份官方核心預載），可隨時匯入個人檔案。
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 font-serif">
                    <CheckCircle2 className="w-4 h-4 text-amber-700" />
                    <span>純粹館員索引</span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1 leading-normal">
                    不代寫教案、不作主觀說教。專門列出精確引句、條目編號與文脈背景供您自行研讀。
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 font-serif">
                    <Globe className="w-4 h-4 text-amber-700" />
                    <span>清楚引用標示</span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1 leading-normal">
                    醒目標明 📌 自訂文件 vs 🌐 網際網路來源，一鍵複製標準學術與教理引用格式。
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsDocManagerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-900 text-amber-100 hover:bg-stone-800 rounded-lg font-medium transition-colors shadow-xs"
                >
                  <FolderUp className="w-4 h-4" />
                  <span>管理自訂資料庫 / 批量上傳文獻</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSearch("聖體聖事的本質與實質轉變")}
                  className="inline-flex items-center gap-1 px-3.5 py-2 bg-white text-stone-700 hover:bg-stone-50 border border-stone-300 rounded-lg transition-colors font-medium shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>立即試查：「聖體聖事」</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isSearching && (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-sm font-bold text-stone-900 font-serif">
              參考館員正在進行教理文獻檢索與比對...
            </div>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              正在自訂文件庫（{documents.length} 篇）提取直接引句、章節定位，並同步進行外部權威資料驗證。
            </p>
          </div>
        )}

        {/* Search Results Display */}
        {currentQuery && !isSearching && (
          <div className="space-y-4">
            {/* Header info of search result */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-50 border border-stone-200/80 px-4 py-2.5 rounded-xl text-xs text-stone-600">
              <div>
                檢索關鍵字：<strong className="text-stone-900 font-serif">「{currentQuery}」</strong>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-stone-500 font-mono">
                {currentScheme === "dual" && <span>雙方案並列呈現</span>}
                {currentScheme === "custom" && <span>方案一：自訂文件庫</span>}
                {currentScheme === "web" && <span>方案二：網際網路文獻</span>}
              </div>
            </div>

            {/* DUAL SCHEME: Side-by-side Layout */}
            {currentScheme === "dual" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Column 1: Custom Uploaded Database */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-300">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-amber-600 text-white">
                        <Database className="w-4 h-4" />
                      </span>
                      <h3 className="text-sm font-bold text-stone-900 font-serif">
                        方案一：自訂上載資料庫尋獲之文獻
                      </h3>
                    </div>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                      {customResult?.citations?.length || 0} 條精確引言
                    </span>
                  </div>

                  {customResult?.summary && (
                    <div className="text-xs text-stone-700 bg-amber-50/50 p-3 rounded-lg border border-amber-200/60 leading-relaxed font-serif">
                      <strong className="text-amber-950 block mb-0.5">館員檢索概述：</strong>
                      {customResult.summary}
                    </div>
                  )}

                  {/* Citations List */}
                  {customResult && customResult.citations.length > 0 ? (
                    <div className="space-y-3">
                      {customResult.citations.map((citation, idx) => (
                        <CustomCitationCard
                          key={idx}
                          citation={citation}
                          onAddToReadingList={handleAddToReadingList}
                          onViewDocument={handleOpenDocPreviewById}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-dashed border-stone-300 p-6 text-center space-y-2">
                      <FileText className="w-8 h-8 text-stone-300 mx-auto" />
                      <div className="text-xs font-medium text-stone-700">
                        在您現有的自訂文件庫中未查找到直接對應之章節
                      </div>
                      <p className="text-[11px] text-stone-500">
                        請參考右欄「網際網路檢索結果」，或前往資料庫上載相關講義文件。
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsDocManagerOpen(true)}
                        className="inline-flex items-center gap-1 text-xs text-amber-800 font-medium hover:underline pt-1"
                      >
                        <FolderUp className="w-3.5 h-3.5" />
                        <span>上載相關文獻至此資料庫</span>
                      </button>
                    </div>
                  )}
                </section>

                {/* Column 2: Web Internet Grounding */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-sky-300">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-sky-700 text-white">
                        <Globe className="w-4 h-4" />
                      </span>
                      <h3 className="text-sm font-bold text-stone-900 font-serif">
                        方案二：網際網路權威教會文獻檢索
                      </h3>
                    </div>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-200">
                      {webResult?.sources?.length || 0} 個外部來源
                    </span>
                  </div>

                  {webResult ? (
                    <WebLibrarianReportCard
                      reportText={webResult.librarianReport}
                      sources={webResult.sources}
                      onAddToReadingList={handleAddToReadingList}
                    />
                  ) : (
                    <div className="bg-white rounded-xl border border-stone-200 p-6 text-center text-xs text-stone-400">
                      尚無網際網路檢索資料
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* SINGLE SCHEME: Custom Database Only */}
            {currentScheme === "custom" && (
              <div className="space-y-4 max-w-4xl mx-auto">
                <div className="flex items-center justify-between pb-2 border-b border-amber-300">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded bg-amber-600 text-white">
                      <Database className="w-4 h-4" />
                    </span>
                    <h3 className="text-base font-bold text-stone-900 font-serif">
                      方案一：自訂上載資料庫尋獲之文獻引證
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-amber-100 text-amber-900 border border-amber-200">
                    共找到 {customResult?.citations?.length || 0} 條文獻引句
                  </span>
                </div>

                {customResult?.summary && (
                  <div className="text-xs text-stone-700 bg-amber-50/50 p-4 rounded-xl border border-amber-200/60 leading-relaxed font-serif">
                    <strong className="text-amber-950 block mb-1">館員檢索概述：</strong>
                    {customResult.summary}
                  </div>
                )}

                {customResult && customResult.citations.length > 0 ? (
                  <div className="space-y-3.5">
                    {customResult.citations.map((citation, idx) => (
                      <CustomCitationCard
                        key={idx}
                        citation={citation}
                        onAddToReadingList={handleAddToReadingList}
                        onViewDocument={handleOpenDocPreviewById}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-dashed border-stone-300 p-8 text-center space-y-2">
                    <FileText className="w-8 h-8 text-stone-300 mx-auto" />
                    <div className="text-sm font-medium text-stone-700">
                      自訂文件庫中未查獲相符字句
                    </div>
                    <p className="text-xs text-stone-500">
                      您可以切換至「方案二：網際網路檢索」查證全球天主教文獻，或匯入相關教材文件。
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentScheme("web");
                        handleSearch(currentQuery);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-700 text-white text-xs font-medium hover:bg-sky-800 transition-colors shadow-xs mt-2"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>切換至方案二：網際網路檢索</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SINGLE SCHEME: Web Search Only */}
            {currentScheme === "web" && (
              <div className="space-y-4 max-w-4xl mx-auto">
                <div className="flex items-center justify-between pb-2 border-b border-sky-300">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded bg-sky-700 text-white">
                      <Globe className="w-4 h-4" />
                    </span>
                    <h3 className="text-base font-bold text-stone-900 font-serif">
                      方案二：網際網路全球天主教權威文獻檢索
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-sky-100 text-sky-900 border border-sky-200">
                    共查獲 {webResult?.sources?.length || 0} 個外部來源
                  </span>
                </div>

                {webResult ? (
                  <WebLibrarianReportCard
                    reportText={webResult.librarianReport}
                    sources={webResult.sources}
                    onAddToReadingList={handleAddToReadingList}
                  />
                ) : (
                  <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-xs text-stone-400">
                    網際網路暫無檢索結果
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white/70 py-4 text-center text-[11px] text-stone-500 font-mono">
        教理講授資料搜尋器 · 參考館員文獻索引系統 · 供教理員細閱自理
      </footer>

      {/* Modals & Drawers */}
      <DocumentManagerModal
        isOpen={isDocManagerOpen}
        onClose={() => setIsDocManagerOpen(false)}
        documents={documents}
        onAddDocument={handleAddDocument}
        onAddDocuments={handleBatchAddDocuments}
        onDeleteDocument={handleDeleteDocument}
        onBatchDeleteDocuments={handleBatchDeleteDocuments}
        onResetPresets={handleResetPresets}
        onPreviewDocument={(doc) => setPreviewDoc(doc)}
      />

      <DocumentPreviewModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      <ReadingListDrawer
        isOpen={isReadingListOpen}
        onClose={() => setIsReadingListOpen(false)}
        items={readingList}
        onRemoveItem={handleRemoveReadingListItem}
        onClearAll={handleClearReadingList}
      />
    </div>
  );
}
