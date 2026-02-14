import React, { useMemo } from "react";
import { Search, Star, Loader2, AlertCircle, Cpu } from "lucide-react";
import Button from "../components/Button";
import type { NanoGPTModel } from "../pages/ConfigDashboard";
import { isFavorite } from "../utils/favorites";

interface ModelSelectorProps {
  isLoadingModels: boolean;
  apiKeyError: string;
  availableModels: NanoGPTModel[];
  selectedModels: string[];
  modelSearchQuery: string;
  setModelSearchQuery: (query: string) => void;
  showOnlyFavorites: boolean;
  setShowOnlyFavorites: (show: boolean) => void;
  favorites: string[];
  toggleModel: (modelId: string) => void;
  handleToggleFavorite: (modelId: string, e: React.MouseEvent) => void;
  loadModels: () => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  isLoadingModels,
  apiKeyError,
  availableModels,
  selectedModels,
  modelSearchQuery,
  setModelSearchQuery,
  showOnlyFavorites,
  setShowOnlyFavorites,
  favorites,
  toggleModel,
  handleToggleFavorite,
  loadModels,
}) => {
  const filteredModels = useMemo(() => {
    return availableModels.filter((model) => {
      const matchesSearch = model.id
        .toLowerCase()
        .includes(modelSearchQuery.toLowerCase());
      const matchesFavoriteFilter =
        !showOnlyFavorites || favorites.includes(model.id);
      return matchesSearch && matchesFavoriteFilter;
    });
  }, [availableModels, modelSearchQuery, showOnlyFavorites, favorites]);

  return (
    <div className="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
      <div className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
        <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        Model Selection
      </div>

      {isLoadingModels ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-sm">Loading available models...</p>
        </div>
      ) : apiKeyError ? (
        <div className="p-6 text-center bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="text-red-800 dark:text-red-300 font-semibold mb-1">
            API Configuration Error
          </h3>
          <p className="text-red-600 dark:text-red-400 text-sm mb-4">
            {apiKeyError}
          </p>
          <Button type="button" onClick={loadModels} variant="danger" size="sm">
            Retry Loading Models
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  placeholder="Search models..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  showOnlyFavorites
                    ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-700"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <Star
                  className={`w-4 h-4 ${showOnlyFavorites ? "fill-current" : ""}`}
                />
                {showOnlyFavorites ? "Showing Favorites" : "Show All"}
              </button>
            </div>
          </div>

          {selectedModels.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Selected ({selectedModels.length}):
              </span>
              {selectedModels.map((modelId: string) => (
                <span
                  key={modelId}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium"
                >
                  {modelId}
                  <button
                    type="button"
                    onClick={() => toggleModel(modelId)}
                    className="hover:text-blue-900 dark:hover:text-blue-200"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
            {filteredModels.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p className="text-sm">No models found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredModels.map((model) => (
                  <label
                    key={model.id}
                    className="flex items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model.id)}
                      onChange={() => toggleModel(model.id)}
                      className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="ml-3 flex-1 text-sm text-slate-700 dark:text-slate-300 font-mono">
                      {model.id}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleToggleFavorite(model.id, e)}
                      className="ml-2 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title={
                        isFavorite(model.id)
                          ? "Remove from favorites"
                          : "Add to favorites"
                      }
                    >
                      <Star
                        className={`w-4 h-4 transition-colors ${
                          favorites.includes(model.id)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-slate-400 hover:text-yellow-400"
                        }`}
                      />
                    </button>
                  </label>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(ModelSelector);
