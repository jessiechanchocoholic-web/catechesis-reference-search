import React, { useState } from "react";
import { ReadingListItem } from "../types";
import {
  X,
  Bookmark,
  FileText,
  Globe,
  Trash2,
  Copy,
  Check,
  Download,
  ExternalLink,
} from "lucide-react";

interface ReadingListDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: ReadingListItem[];
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
}

export const ReadingListDrawer: React.FC<ReadingListDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onRemoveItem,
  onClearAll,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyAll = () => {
    if (items.length === 0) return;

    const formatted = items
      .map((item, idx) => {
        const sourceLabel =
          item.sourceType === "custom"
            ? "【自訂上載資料庫】"
            : "【網際網路全球來源】";
        return `### ${idx + 1}. ${sourceLabel} ${item.sourceTitle}
- **章節/條目定位**：${item.locator}
- **核心引句**：
> ${item.quoteOrSnippet}
${item.context ? `- **文脈說明**：${item.context}` : ""}
${item.url ? `- **來源連結**：${item.url}` : ""}
`;
      })
      .join("\n---\n\n");

    const header = `# 教理講授資料細閱清單\n匯出時間：${new Date().toLocaleString("zh-TW")}\n總計收錄：${items.length} 條文獻引證\n\n`;
    navigator.clipboard.writeText(header + formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMarkdown = () => {
    if (items.length === 0) return;

    const formatted = items
      .map((item, idx) => {
        const sourceLabel =
          item.sourceType === "custom"
            ? "【自訂上載資料庫】"
            : "【網際網路全球來源】";
        return `### ${idx + 1}. ${sourceLabel} ${item.sourceTitle}
- **章節/條目定位**：${item.locator}
- **核心引句**：
> ${item.quoteOrSnippet}
${item.context ? `- **文脈說明**：${item.context}` : ""}
${item.url ? `- **來源連結**：${item.url}` : ""}
`;
      })
      .join("\n---\n\n");

    const header = `# 教理講授資料細閱清單\n匯出時間：${new Date().toLocaleString("zh-TW")}\n總計收錄：${items.length} 條文獻引證\n\n`;
    const blob = new Blob([header + formatted], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `教理講授文獻細閱清單-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40 backdrop-blur-2xs">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col border-l border-stone-200">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-amber-700" />
            <div>
              <h3 className="text-sm font-bold text-stone-900 font-serif">
                待細閱文獻清單
              </h3>
              <p className="text-[11px] text-stone-500">
                已收錄 {items.length} 條供您後續細閱與備課之引證
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        {items.length > 0 && (
          <div className="px-5 py-2.5 bg-stone-100/70 border-b border-stone-200 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyAll}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 transition-colors font-medium text-[11px]"
                title="複製全部清單為 Markdown 文本"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>已複製全部</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>複製全部</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleExportMarkdown}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 transition-colors font-medium text-[11px]"
                title="下載 Markdown 筆記檔案"
              >
                <Download className="w-3 h-3 text-stone-600" />
                <span>匯出 .md</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClearAll}
              className="text-[11px] text-stone-400 hover:text-red-600 transition-colors"
            >
              清空
            </button>
          </div>
        )}

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-16 text-stone-400">
              <Bookmark className="w-8 h-8 mx-auto mb-2 text-stone-300" />
              <p className="text-xs font-medium text-stone-600">
                目前清單尚無項目
              </p>
              <p className="text-[11px] mt-1 text-stone-400">
                檢索時點擊引用卡右下角「加入細閱」，即可將文獻條目存入此處。
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border text-xs relative group ${
                  item.sourceType === "custom"
                    ? "bg-amber-50/40 border-amber-200"
                    : "bg-sky-50/40 border-sky-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      item.sourceType === "custom"
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : "bg-sky-100 text-sky-900 border border-sky-300"
                    }`}
                  >
                    {item.sourceType === "custom" ? (
                      <>
                        <FileText className="w-3 h-3" />
                        📌 自訂資料庫
                      </>
                    ) : (
                      <>
                        <Globe className="w-3 h-3" />
                        🌐 網際網路
                      </>
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="text-stone-400 hover:text-red-600 p-0.5"
                    title="從清單移除"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                <div className="font-semibold text-stone-900 font-serif line-clamp-1">
                  {item.sourceTitle}
                </div>

                {item.locator && (
                  <div className="text-[11px] font-mono text-stone-600 mt-0.5">
                    {item.locator}
                  </div>
                )}

                <div className="mt-2 pl-2 border-l-2 border-stone-300 text-stone-800 font-serif italic line-clamp-3">
                  「{item.quoteOrSnippet}」
                </div>

                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-[11px] text-sky-700 hover:underline flex items-center gap-1 truncate"
                  >
                    <span>外部來源連結</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
