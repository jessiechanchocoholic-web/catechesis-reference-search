import React, { useState } from "react";
import { CustomCitation, WebSource } from "../types";
import {
  FileText,
  Globe,
  Quote,
  Copy,
  Check,
  BookmarkPlus,
  ExternalLink,
  BookOpen,
  Compass,
} from "lucide-react";

interface CustomCitationCardProps {
  citation: CustomCitation;
  onAddToReadingList: (item: {
    sourceType: "custom";
    sourceTitle: string;
    locator: string;
    quoteOrSnippet: string;
    context?: string;
  }) => void;
  onViewDocument?: (docId: string) => void;
}

export const CustomCitationCard: React.FC<CustomCitationCardProps> = ({
  citation,
  onAddToReadingList,
  onViewDocument,
}) => {
  const [copied, setCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const handleCopyCitation = () => {
    const formatted = `【自訂資料庫引用標示】\n文獻來源：${citation.documentTitle}\n條目/章節定位：${citation.sectionLocator}\n教理主題：${citation.catecheticalTheme || "未分類"}\n原文直接引句：\n「${citation.exactQuote}」\n文脈背景：${citation.contextSnippet}`;
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBookmark = () => {
    onAddToReadingList({
      sourceType: "custom",
      sourceTitle: citation.documentTitle,
      locator: citation.sectionLocator,
      quoteOrSnippet: citation.exactQuote,
      context: citation.contextSnippet,
    });
    setBookmarked(true);
    setTimeout(() => setBookmarked(false), 2000);
  };

  return (
    <article className="bg-white rounded-xl border-2 border-amber-200/80 p-4 sm:p-5 shadow-xs transition-all hover:border-amber-300 hover:shadow-sm">
      {/* Attribution Badge Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300/80 shadow-2xs">
            <FileText className="w-3.5 h-3.5 text-amber-800" />
            📌 自訂上載資料庫
          </span>
          <span className="text-xs font-semibold text-stone-700 font-serif line-clamp-1">
            {citation.documentTitle}
          </span>
        </div>

        {citation.sectionLocator && (
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
            {citation.sectionLocator}
          </span>
        )}
      </div>

      {/* Exact Quote */}
      <div className="mt-3.5 relative bg-amber-50/40 rounded-lg p-3.5 border border-amber-200/50">
        <Quote className="w-5 h-5 text-amber-500/50 absolute top-2.5 left-2.5 pointer-events-none" />
        <p className="pl-6 text-sm text-stone-900 font-serif leading-relaxed font-medium">
          {citation.exactQuote}
        </p>
      </div>

      {/* Context & Librarian Note */}
      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-stone-600">
        {citation.contextSnippet && (
          <div className="bg-stone-50 rounded p-2.5 border border-stone-200/60">
            <span className="font-semibold text-stone-700 block mb-0.5 font-serif">
              📖 前後文脈簡述：
            </span>
            <p className="text-stone-600 leading-normal">{citation.contextSnippet}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-stone-500">
          {citation.relevanceSummary && (
            <span className="italic">
              <strong className="font-semibold text-stone-700 not-italic">館員索引備註：</strong>
              {citation.relevanceSummary}
            </span>
          )}
          {citation.catecheticalTheme && (
            <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
              範疇：{citation.catecheticalTheme}
            </span>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between flex-wrap gap-2">
        <div className="text-[11px] text-stone-400 font-mono">
          供教理員細閱與備課使用
        </div>

        <div className="flex items-center gap-1.5">
          {onViewDocument && (
            <button
              type="button"
              onClick={() => onViewDocument(citation.documentId)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 transition-colors"
              title="查看自訂文獻全文"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>查閱原文</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyCitation}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 transition-colors"
            title="複製標準引用格式"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-medium">已複製</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>複製引用</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleBookmark}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300/80 font-medium transition-colors"
            title="儲存至待細閱清單"
          >
            {bookmarked ? (
              <>
                <Check className="w-3.5 h-3.5 text-amber-700" />
                <span>已存入清單</span>
              </>
            ) : (
              <>
                <BookmarkPlus className="w-3.5 h-3.5 text-amber-700" />
                <span>加入細閱</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};

interface WebLibrarianReportProps {
  reportText: string;
  sources: WebSource[];
  onAddToReadingList: (item: {
    sourceType: "web";
    sourceTitle: string;
    locator: string;
    quoteOrSnippet: string;
    url?: string;
  }) => void;
}

export const WebLibrarianReportCard: React.FC<WebLibrarianReportProps> = ({
  reportText,
  sources,
  onAddToReadingList,
}) => {
  const [copied, setCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const handleCopy = () => {
    const text = `【網際網路文獻引用標示】\n${reportText}\n\n參考來源網址：\n${sources.map((s) => `- ${s.title}: ${s.uri}`).join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBookmark = () => {
    onAddToReadingList({
      sourceType: "web",
      sourceTitle: "網際網路全球教會文獻檢索",
      locator: sources[0]?.title || "外部教會文獻庫",
      quoteOrSnippet: reportText.slice(0, 300) + "...",
      url: sources[0]?.uri,
    });
    setBookmarked(true);
    setTimeout(() => setBookmarked(false), 2000);
  };

  return (
    <article className="bg-white rounded-xl border-2 border-sky-200/80 p-4 sm:p-5 shadow-xs transition-all hover:border-sky-300 hover:shadow-sm">
      {/* Badge Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-sky-100 text-sky-900 border border-sky-300/80 shadow-2xs">
            <Globe className="w-3.5 h-3.5 text-sky-700" />
            🌐 網際網路全球文獻來源
          </span>
          <span className="text-xs text-stone-500 font-sans">
            Poe Web-Search 引用
          </span>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
          共尋獲 {sources.length} 個權威外部來源
        </span>
      </div>

      {/* Librarian Finding Report */}
      <div className="mt-3.5 text-sm text-stone-800 leading-relaxed font-serif whitespace-pre-line bg-stone-50/70 p-4 rounded-lg border border-stone-200/70">
        {reportText}
      </div>

      {/* Cited Web Links */}
      {sources.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-stone-100">
          <div className="text-xs font-bold text-stone-700 mb-2 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-sky-700" />
            網際網路直接文獻出處（可點擊細閱官方全文）：
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sources.map((src, i) => (
              <a
                key={i}
                href={src.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-white border border-stone-200 hover:border-sky-400 hover:bg-sky-50/50 transition-colors text-xs text-sky-800 group"
              >
                <span className="truncate font-medium">{src.title}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 text-stone-400 group-hover:text-sky-700" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Card Actions */}
      <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between flex-wrap gap-2">
        <div className="text-[11px] text-stone-400 font-mono">
          供後續細閱外部資料與對照驗證
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-medium">已複製</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>複製網上引文</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleBookmark}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-300/80 font-medium transition-colors"
          >
            {bookmarked ? (
              <>
                <Check className="w-3.5 h-3.5 text-sky-700" />
                <span>已存入清單</span>
              </>
            ) : (
              <>
                <BookmarkPlus className="w-3.5 h-3.5 text-sky-700" />
                <span>加入細閱</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};
