import React from "react";
import { CatechismDocument } from "../types";
import { X, BookOpen, FileText, Copy, Check } from "lucide-react";

interface DocumentPreviewModalProps {
  document: CatechismDocument | null;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  document,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!document) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(document.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-stone-900 text-amber-200">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 font-serif line-clamp-1">
                {document.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                <span className="px-2 py-0.5 rounded bg-stone-200/80 text-stone-700">
                  {document.category}
                </span>
                <span>約 {document.wordCount} 字元</span>
                {document.sourceMeta && <span>· {document.sourceMeta}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content reader */}
        <div className="p-6 overflow-y-auto flex-1 bg-stone-50/40 space-y-4">
          {document.imageUrl && (
            <div className="max-w-2xl mx-auto bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100 text-[11px] text-stone-500 font-mono">
                <span className="flex items-center gap-1.5 text-amber-900 font-medium">
                  <span>🎨</span>
                  <span>聖經故事插圖動畫工作室 · 主日福音圖原作</span>
                </span>
                <a
                  href={document.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-700 hover:text-amber-900 hover:underline"
                >
                  在新分頁查看原圖 ↗
                </a>
              </div>
              <div className="rounded-lg overflow-hidden bg-stone-900/5 flex items-center justify-center max-h-[380px]">
                <img
                  src={document.imageUrl}
                  alt={document.title}
                  className="max-h-[380px] w-auto object-contain mx-auto rounded"
                />
              </div>
            </div>
          )}

          <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl border border-stone-200 shadow-2xs">
            <div className="text-xs font-bold text-stone-500 mb-2 font-mono uppercase tracking-wide">
              {document.imageUrl ? "【圖文解說與章節索引內容】" : "【文獻全文】"}
            </div>
            <pre className="text-xs sm:text-sm text-stone-800 font-serif leading-relaxed whitespace-pre-wrap font-normal">
              {document.content}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-200 bg-white flex items-center justify-between">
          <div className="text-xs text-stone-500 font-mono">
            來源：自訂上載資料庫 · 供講授員細閱
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">已複製全文</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>複製全文</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
