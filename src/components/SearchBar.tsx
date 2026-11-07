import React, { useState } from "react";
import { Search, Sparkles, X, History } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

const QUICK_QUERIES = [
  "聖體聖事的本質與實質轉變",
  "路加福音浪子回頭的比喻中父親的態度",
  "和好聖事中何謂完美痛悔",
  "信德的定義與人對天主的回應",
  "基督徒主禱文的意義與阿爸父的呼求",
  "梵二教會憲章中信友普通司祭職",
];

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading }) => {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSearch(query.trim());
    }
  };

  const handleSelectQuick = (q: string) => {
    setQuery(q);
    onSearch(q);
  };

  return (
    <div className="w-full space-y-2.5">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-3.5 pointer-events-none text-stone-400">
          <Search className="w-5 h-5" />
        </div>
        <input
          id="search-input-field"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="請輸入教理講授要查找的主題、經文條目或神學問題（例如：聖體聖事的本質、浪子回頭...）"
          className="w-full pl-11 pr-24 py-3.5 bg-white rounded-xl border border-stone-300 text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 shadow-xs transition-all font-sans"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-20 text-stone-400 hover:text-stone-600 p-1"
            title="清除文字"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          type="submit"
          id="btn-execute-search"
          disabled={!query.trim() || isLoading}
          className="absolute right-2 px-4 py-2 bg-stone-900 text-amber-100 hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400 font-medium text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
        >
          {isLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-amber-200 border-t-transparent rounded-full animate-spin" />
              <span>館員檢索中...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>文獻檢索</span>
            </>
          )}
        </button>
      </form>

      {/* Suggested Reference Topics */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs no-scrollbar">
        <span className="text-stone-400 shrink-0 flex items-center gap-1 font-serif text-[11px]">
          <History className="w-3 h-3" />
          建議檢索主題：
        </span>
        {QUICK_QUERIES.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSelectQuick(q)}
            disabled={isLoading}
            className="shrink-0 px-2.5 py-1 rounded-md bg-stone-100/90 text-stone-700 hover:bg-amber-100/70 hover:text-amber-900 border border-stone-200/80 transition-colors text-[11px]"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
};
