import React from "react";
import { SearchScheme } from "../types";
import { Layers, Database, Globe, Info } from "lucide-react";

interface SchemeSelectorProps {
  currentScheme: SearchScheme;
  onSelectScheme: (scheme: SearchScheme) => void;
  customDocCount: number;
}

export const SchemeSelector: React.FC<SchemeSelectorProps> = ({
  currentScheme,
  onSelectScheme,
  customDocCount,
}) => {
  return (
    <div className="w-full bg-white rounded-xl border border-stone-200 p-2 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 mb-2 border-b border-stone-100 text-xs text-stone-500">
        <div className="flex items-center gap-1.5 font-medium text-stone-700">
          <Info className="w-3.5 h-3.5 text-amber-700" />
          <span>檢索方案選擇（嚴格標註引用來源，區分自訂文件與網際網路）</span>
        </div>
        <div className="text-[11px] text-stone-400">
          搜尋根源優先：以您上載的自訂庫 ({customDocCount} 份) 為第一基準
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Dual Mode */}
        <button
          type="button"
          id="scheme-toggle-dual"
          onClick={() => onSelectScheme("dual")}
          className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
            currentScheme === "dual"
              ? "bg-amber-50/70 border-amber-300 ring-1 ring-amber-300/60"
              : "bg-white border-stone-200 hover:bg-stone-50 text-stone-700"
          }`}
        >
          <div
            className={`p-2 rounded-md ${
              currentScheme === "dual"
                ? "bg-amber-600 text-white"
                : "bg-stone-100 text-stone-600"
            }`}
          >
            <Layers className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900">
                雙方案對照檢索
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                推薦方案
              </span>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5 leading-tight">
              左欄自訂文件庫 + 右欄網際網路權威文獻，全面雙軌引證
            </p>
          </div>
        </button>

        {/* Custom Database Only */}
        <button
          type="button"
          id="scheme-toggle-custom"
          onClick={() => onSelectScheme("custom")}
          className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
            currentScheme === "custom"
              ? "bg-amber-50/70 border-amber-300 ring-1 ring-amber-300/60"
              : "bg-white border-stone-200 hover:bg-stone-50 text-stone-700"
          }`}
        >
          <div
            className={`p-2 rounded-md ${
              currentScheme === "custom"
                ? "bg-stone-900 text-amber-300"
                : "bg-stone-100 text-stone-600"
            }`}
          >
            <Database className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900">
                方案一：僅自訂上載資料庫
              </span>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5 leading-tight">
              純粹在您已上載的文件庫內精準查找定位，不連外網
            </p>
          </div>
        </button>

        {/* Web Search Only */}
        <button
          type="button"
          id="scheme-toggle-web"
          onClick={() => onSelectScheme("web")}
          className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
            currentScheme === "web"
              ? "bg-amber-50/70 border-amber-300 ring-1 ring-amber-300/60"
              : "bg-white border-stone-200 hover:bg-stone-50 text-stone-700"
          }`}
        >
          <div
            className={`p-2 rounded-md ${
              currentScheme === "web"
                ? "bg-sky-700 text-white"
                : "bg-stone-100 text-stone-600"
            }`}
          >
            <Globe className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900">
                方案二：僅網際網路檢索
              </span>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5 leading-tight">
              透過 Google Search 檢索梵蒂岡、全球教會官方文獻與思高經文
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};
