import React, { useState, useEffect, useCallback } from "react";
import { Trash2, Loader2, AlertCircle, Dices } from "lucide-react";

interface WikiPairRowProps {
  index: number;
  pair: { start_page: string; target_page: string };
  pathInfo: { length: number | null; loading: boolean; error: string | null };
  isFetchingRandom: { source: boolean; target: boolean };
  onUpdate: (index: number, field: "start_page" | "target_page", value: string) => void;
  onRemove: (index: number) => void;
  onRandomPage: (type: "source" | "target", index: number) => void;
  showRemoveButton: boolean;
}

const WikiPairRow: React.FC<WikiPairRowProps> = ({
  index,
  pair,
  pathInfo,
  isFetchingRandom,
  onUpdate,
  onRemove,
  onRandomPage,
  showRemoveButton,
}) => {
  // Local state for immediate feedback during typing
  const [localStartPage, setLocalStartPage] = useState(pair.start_page);
  const [localTargetPage, setLocalTargetPage] = useState(pair.target_page);

  useEffect(() => {
    setLocalStartPage(pair.start_page);
  }, [pair.start_page]);

  useEffect(() => {
    setLocalTargetPage(pair.target_page);
  }, [pair.target_page]);

  const handleStartPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalStartPage(val);
    onUpdate(index, "start_page", val);
  };

  const handleTargetPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalTargetPage(val);
    onUpdate(index, "target_page", val);
  };

  return (
    <div className="relative p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Pair #{index + 1}
          </span>
          {pathInfo?.loading ? (
            <div className="flex items-center gap-2 text-[10px] text-blue-600 dark:text-blue-400 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              Calculating optimal path length...
            </div>
          ) : (pathInfo?.length ?? null) !== null ? (
            <div className="flex items-center gap-2 text-[10px] text-green-600 dark:text-green-400 font-medium">
              Optimal path length: {pathInfo.length} clicks
            </div>
          ) : pathInfo?.error ? (
            <div className="flex items-center gap-2 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-3 h-3" />
              {pathInfo.error}
            </div>
          ) : null}
        </div>
        {showRemoveButton && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
            title="Remove pair"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Source URL
            </label>
          </div>
          <div className="relative">
            <input
              type="url"
              value={localStartPage}
              onChange={handleStartPageChange}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className="w-full pl-4 pr-10 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:border-transparent outline-none transition-all"
              placeholder="https://en.wikipedia.org/wiki/Philosophy"
              required
            />
            <button
              type="button"
              onClick={() => onRandomPage("source", index)}
              disabled={isFetchingRandom?.source}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
              title="Get random page"
            >
              {isFetchingRandom?.source ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Dices className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Target URL
            </label>
          </div>
          <div className="relative">
            <input
              type="url"
              value={localTargetPage}
              onChange={handleTargetPageChange}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className="w-full pl-4 pr-10 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:border-transparent outline-none transition-all"
              placeholder="https://en.wikipedia.org/wiki/Quantum_mechanics"
              required
            />
            <button
              type="button"
              onClick={() => onRandomPage("target", index)}
              disabled={isFetchingRandom?.target}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
              title="Get random page"
            >
              {isFetchingRandom?.target ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Dices className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(WikiPairRow);
