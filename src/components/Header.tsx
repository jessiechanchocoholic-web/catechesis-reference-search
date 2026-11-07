import React from "react";
import { BookOpen, FolderUp, Bookmark, Library, Compass, Download } from "lucide-react";

interface HeaderProps {
  documentCount: number;
  readingListCount: number;
  onOpenDocManager: () => void;
  onOpenReadingList: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  documentCount,
  readingListCount,
  onOpenDocManager,
  onOpenReadingList,
}) => {
  return (
    <header className="border-b border-stone-200 bg-stone-50/90 backdrop-blur sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Brand & Concept */}
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-stone-800 text-amber-100 flex items-center justify-center shadow-xs">
            <BookOpen className="w-5 h-5 text-amber-300/90" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-stone-900 tracking-tight font-serif">
                教理講授資料搜尋器
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100/80 text-amber-900 border border-amber-200/60">
                參考館員索引模式
              </span>
            </div>
            <p className="text-xs text-stone-500 line-clamp-1">
              以自訂上載資料庫為搜尋基地 · 不寫教案 · 專注文獻引證與章節索引
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {/* Custom Document Base Manager */}
          <button
            id="btn-open-doc-manager"
            onClick={onOpenDocManager}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 hover:text-stone-900 transition-colors shadow-xs"
            title="管理與上載自訂文獻"
          >
            <FolderUp className="w-3.5 h-3.5 text-stone-600" />
            <span>自訂資料庫</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-stone-100 text-stone-600 font-semibold border border-stone-200">
              {documentCount} 篇
            </span>
          </button>

          {/* Reading List / Bookmarks */}
          <button
            id="btn-open-reading-list"
            onClick={onOpenReadingList}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 hover:text-stone-900 transition-colors shadow-xs"
            title="查看待細閱之引用文獻清單"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-700" />
            <span>待細閱清單</span>
            {readingListCount > 0 ? (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-600 text-white font-semibold text-[11px]">
                {readingListCount}
              </span>
            ) : (
              <span className="ml-1 text-stone-400">0</span>
            )}
          </button>

          {/* Download Packaged Code */}
          <a
            href="/api/download-package"
            download="catechesis-reference-search.zip"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-stone-700 bg-white border border-stone-300 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-400 transition-colors shadow-xs"
            title="打包下載完整專案源代碼 (.zip)，可直接搬遷至本機或外部伺服器運行"
          >
            <Download className="w-3.5 h-3.5 text-stone-600" />
            <span className="hidden md:inline">打包下載源碼 (.zip)</span>
            <span className="md:hidden">導出源碼</span>
          </a>
        </div>
      </div>
    </header>
  );
};
