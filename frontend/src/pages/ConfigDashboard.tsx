import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Settings2,
  Link,
  Cpu,
  XCircle,
  Loader2,
  Search,
  Star,
  HelpCircle,
  AlertCircle,
  Dices,
  Plus,
  Trash2,
} from "lucide-react";
import { startBenchmark, validateWikiUrl, getModelsFromBackend, getRandomWikiPage, getWikiPath } from "../services/api";

export interface NanoGPTModel {
  id: string;
  name?: string;
  created?: number;
  owned_by?: string;
}

import { getFavorites, toggleFavorite, isFavorite } from "../utils/favorites";
import { useDebounce } from "../hooks/useDebounce";

const STORAGE_KEY = "benchmark_config";

const ConfigDashboard = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const savedConfig = JSON.parse(saved);
        // Migration for old config format
        const pairs = savedConfig.pairs || [
          {
            start_page: savedConfig.sourcePage || "",
            target_page: savedConfig.targetPage || "",
          },
        ];
        return {
          models: savedConfig.models || [],
          pairs: pairs,
          maxClicks: savedConfig.maxClicks || 15,
          maxLoops: savedConfig.maxLoops || 3,
          maxHallucinations: savedConfig.maxHallucinations || 3,
          temperature: savedConfig.temperature ?? 0.0,
        };
      } catch (e) {
        console.error("Failed to parse saved config", e);
      }
    }
    return {
      models: [],
      pairs: [{ start_page: "", target_page: "" }],
      maxClicks: 15,
      maxLoops: 3,
      maxHallucinations: 3,
      temperature: 0.0,
    };
  });

  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [availableModels, setAvailableModels] = useState<NanoGPTModel[]>([]);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);
  const [isFetchingRandom, setIsFetchingRandom] = useState<Record<number, { source: boolean; target: boolean }>>({});
  const [wikiPathInfo, setWikiPathInfo] = useState<Record<number, { length: number | null; loading: boolean; error: string | null }>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  const debouncedConfig = useDebounce(config, 500);

  useEffect(() => {
    // Save the entire config to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(debouncedConfig));
  }, [debouncedConfig]);

  const validatePath = async (source: string, target: string, index: number) => {
    setWikiPathInfo(prev => ({
      ...prev,
      [index]: { ...(prev[index] || {}), loading: true, error: null }
    }));
    try {
      const result = await getWikiPath(source, target);
      if (result.found) {
        setWikiPathInfo(prev => ({
          ...prev,
          [index]: { length: result.length ?? null, loading: false, error: null }
        }));
      } else {
        setWikiPathInfo(prev => ({
          ...prev,
          [index]: { length: null, loading: false, error: result.error || "No path found" }
        }));
      }
    } catch (err) {
      setWikiPathInfo(prev => ({
        ...prev,
        [index]: { length: null, loading: false, error: "Failed to calculate path" }
      }));
    }
  };

  useEffect(() => {
    // Load favorites on mount
    setFavorites(getFavorites());
  }, []);

  useEffect(() => {
    // Load models on mount
    loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const loadModels = async () => {
    setIsLoadingModels(true);
    setApiKeyError("");

    try {
      const models = await getModelsFromBackend();
      setAvailableModels(models);
      setIsLoadingModels(false);
    } catch (error) {
      console.error("Error loading models:", error);
      setApiKeyError(error instanceof Error ? error.message : "Failed to load models from backend.");
      setIsLoadingModels(false);
      setAvailableModels([]);
      setConfig({ ...config, models: [] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (availableModels.length === 0) {
      setErrorMessage(
        "No models available. Please check your API configuration.",
      );
      return;
    }

    if (config.models.length === 0) {
      setErrorMessage("Please select at least one model");
      return;
    }

    if (config.pairs.some((p: any) => !p.start_page.trim() || !p.target_page.trim())) {
      setErrorMessage("Please provide both source and target URLs for all pairs");
      return;
    }

    setIsLaunching(true);
    setErrorMessage("");

    try {
      // Validate all pairs
      for (let i = 0; i < config.pairs.length; i++) {
        const pair = config.pairs[i];
        const [sourceValid, targetValid] = await Promise.all([
          validateWikiUrl(pair.start_page),
          validateWikiUrl(pair.target_page),
        ]);

        if (!sourceValid.valid) {
          setErrorMessage(`Pair ${i + 1} - Invalid Source URL: ${sourceValid.error}`);
          setIsLaunching(false);
          return;
        }

        if (!targetValid.valid) {
          setErrorMessage(`Pair ${i + 1} - Invalid Target URL: ${targetValid.error}`);
          setIsLaunching(false);
          return;
        }
      }

      const response = await startBenchmark({
        models: config.models,
        pairs: config.pairs,
        max_steps: config.maxClicks,
        max_loops: config.maxLoops,
        max_hallucination_retries: config.maxHallucinations,
        temperature: config.temperature,
      });

      // Navigate to live monitoring
      navigate(`/live/${response.run_id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `Failed to start benchmark: ${error.message}`
          : "Failed to start benchmark. Please check your configuration and try again.",
      );
      setIsLaunching(false);
    }
  };

  const filteredModels = availableModels.filter((model) => {
    const matchesSearch = model.id
      .toLowerCase()
      .includes(modelSearchQuery.toLowerCase());
    const matchesFavoriteFilter =
      !showOnlyFavorites || favorites.includes(model.id);
    return matchesSearch && matchesFavoriteFilter;
  });

  const handleToggleFavorite = (modelId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(modelId);
    setFavorites(getFavorites());
  };

  const toggleModel = (modelId: string) => {
    const newModels = config.models.includes(modelId)
      ? config.models.filter((m: string) => m !== modelId)
      : [...config.models, modelId];
    setConfig({ ...config, models: newModels });
  };

  const handleRandomPage = async (type: "source" | "target", index: number) => {
    setIsFetchingRandom((prev) => ({
      ...prev,
      [index]: { ...(prev[index] || { source: false, target: false }), [type]: true }
    }));
    try {
      const { url } = await getRandomWikiPage();
      const newPairs = [...config.pairs];
      const updatedPair = {
        ...newPairs[index],
        [type === "source" ? "start_page" : "target_page"]: url,
      };
      newPairs[index] = updatedPair;
      
      setConfig((prev: any) => ({
        ...prev,
        pairs: newPairs,
      }));

      if (updatedPair.start_page && updatedPair.target_page) {
        validatePath(updatedPair.start_page, updatedPair.target_page, index);
      }
    } catch (error) {
      console.error("Failed to fetch random page:", error);
      setErrorMessage("Failed to fetch a random Wikipedia page.");
    } finally {
      setIsFetchingRandom((prev) => ({
        ...prev,
        [index]: { ...(prev[index] || { source: false, target: false }), [type]: false }
      }));
    }
  };

  const addPair = () => {
    const newIndex = config.pairs.length;
    setConfig({
      ...config,
      pairs: [...config.pairs, { start_page: "", target_page: "" }],
    });
    setWikiPathInfo(prev => ({
      ...prev,
      [newIndex]: { length: null, loading: false, error: null }
    }));
  };

  const removePair = (index: number) => {
    if (config.pairs.length <= 1) return;
    const newPairs = config.pairs.filter((_: any, i: number) => i !== index);
    setConfig({ ...config, pairs: newPairs });
    
    // Rebuild wikiPathInfo to match new indices
    setWikiPathInfo(prev => {
      const newInfo: Record<number, any> = {};
      newPairs.forEach((_: any, i: number) => {
        // If the pair at new index i was at old index j
        const oldIndex = i < index ? i : i + 1;
        if (prev[oldIndex]) {
          newInfo[i] = prev[oldIndex];
        }
      });
      return newInfo;
    });
  };

  // Use a ref to store timeout IDs for debounced validation per index
  const validationTimeouts = React.useRef<Record<number, any>>({});

  const updatePair = (index: number, field: "start_page" | "target_page", value: string) => {
    const newPairs = [...config.pairs];
    const updatedPair = { ...newPairs[index], [field]: value };
    newPairs[index] = updatedPair;
    setConfig({ ...config, pairs: newPairs });

    // Clear existing timeout for this index
    if (validationTimeouts.current[index]) {
      clearTimeout(validationTimeouts.current[index]);
    }

    if (updatedPair.start_page && updatedPair.target_page) {
      // Debounce validation for manual typing
      validationTimeouts.current[index] = setTimeout(() => {
        validatePath(updatedPair.start_page, updatedPair.target_page, index);
      }, 1000);
    } else {
      setWikiPathInfo(prev => ({
        ...prev,
        [index]: { length: null, loading: false, error: null }
      }));
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          New Benchmark
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Configure your Wikipedia navigation test.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
              <h3 className="text-red-800 dark:text-red-300 font-semibold mb-1">API Configuration Error</h3>
              <p className="text-red-600 dark:text-red-400 text-sm mb-4">{apiKeyError}</p>
              <button
                type="button"
                onClick={loadModels}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Retry Loading Models
              </button>
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

              {config.models.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Selected ({config.models.length}):
                  </span>
                  {config.models.map((modelId: string) => (
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
                          checked={config.models.includes(model.id)}
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

        <div className="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200">
              <Link className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Wikipedia Paths
            </div>
            <button
              type="button"
              onClick={addPair}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Pair
            </button>
          </div>
          
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Enter the full English Wikipedia URLs for the source and target pages. You can configure multiple pairs to be processed sequentially.
          </p>

          <div className="space-y-8">
            {config.pairs.map((pair: any, index: number) => (
              <div key={index} className="relative p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pair #{index + 1}</span>
                  {config.pairs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePair(index)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      title="Remove pair"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    {wikiPathInfo[index]?.loading ? (
                      <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Calculating optimal path length...
                      </div>
                    ) : (wikiPathInfo[index]?.length ?? null) !== null ? (
                      <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 font-medium">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        Optimal path length: {wikiPathInfo[index].length} clicks
                      </div>
                    ) : wikiPathInfo[index]?.error ? (
                      <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                        <AlertCircle className="w-3 h-3" />
                        {wikiPathInfo[index].error}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Source URL
                      </label>
                    </div>
                    <div className="relative">
                      <input
                        type="url"
                        value={pair.start_page}
                        onChange={(e) => updatePair(index, "start_page", e.target.value)}
                        className="w-full pl-4 pr-10 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="https://en.wikipedia.org/wiki/Philosophy"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => handleRandomPage("source", index)}
                        disabled={isFetchingRandom[index]?.source}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
                        title="Get random page"
                      >
                        {isFetchingRandom[index]?.source ? (
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
                        value={pair.target_page}
                        onChange={(e) => updatePair(index, "target_page", e.target.value)}
                        className="w-full pl-4 pr-10 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="https://en.wikipedia.org/wiki/Quantum_mechanics"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => handleRandomPage("target", index)}
                        disabled={isFetchingRandom[index]?.target}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
                        title="Get random page"
                      >
                        {isFetchingRandom[index]?.target ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Dices className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex justify-end items-center gap-3">
            <a
              href="https://en.wikipedia.org/api/rest_v1/#/Page_content/getRandomSummary"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-slate-400 hover:text-blue-500 transition-colors flex items-center gap-1"
            >
              <Dices className="w-3 h-3" />
              Random via Wikipedia API
            </a>
            <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <a
              href="https://wikiroute.revig.nl/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-slate-400 hover:text-blue-500 transition-colors flex items-center gap-1"
            >
              <Link className="w-3 h-3" />
              Path via WikiRoute API
            </a>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
            <Settings2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Advanced Parameters
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-10">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Max Clicks
                </label>
                <div className="group relative">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center pointer-events-none z-10">
                    Maximum number of steps allowed to reach the target page.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={config.maxClicks}
                  onChange={(e) =>
                    setConfig({ ...config, maxClicks: parseInt(e.target.value) })
                  }
                  className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={config.maxClicks}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) {
                      setConfig({
                        ...config,
                        maxClicks: Math.min(50, Math.max(5, val)),
                      });
                    }
                  }}
                  className="w-16 px-2 py-1 text-right text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Max Loops
                </label>
                <div className="group relative">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center pointer-events-none z-10">
                    Maximum number of times the model can visit the same page before failing (prevents infinite loops).
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={config.maxLoops}
                  onChange={(e) =>
                    setConfig({ ...config, maxLoops: parseInt(e.target.value) })
                  }
                  className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={config.maxLoops}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) {
                      setConfig({
                        ...config,
                        maxLoops: Math.min(10, Math.max(1, val)),
                      });
                    }
                  }}
                  className="w-16 px-2 py-1 text-right text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Temperature
                </label>
                <div className="group relative">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center pointer-events-none z-10">
                    Lower values make the model more deterministic, higher values
                    make it more creative.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.temperature}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        temperature: parseFloat(e.target.value),
                      })
                    }
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between w-full text-[10px] text-slate-400 mt-1 absolute -bottom-4 px-1 pointer-events-none">
                    <span>Precise (0.0)</span>
                    <span>Creative (1.0)</span>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={config.temperature}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      setConfig({
                        ...config,
                        temperature: Math.min(1, Math.max(0, val)),
                      });
                    }
                  }}
                  className="w-20 px-2 py-1 text-right text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Max Hallucinations
                </label>
                <div className="group relative">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center pointer-events-none z-10">
                    Maximum consecutive invalid links (hallucinations) allowed on a single page before failing.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={config.maxHallucinations}
                  onChange={(e) =>
                    setConfig({ ...config, maxHallucinations: parseInt(e.target.value) })
                  }
                  className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={config.maxHallucinations}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) {
                      setConfig({
                        ...config,
                        maxHallucinations: Math.min(10, Math.max(1, val)),
                      });
                    }
                  }}
                  className="w-16 px-2 py-1 text-right text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={
            isLaunching ||
            isLoadingModels ||
            !!apiKeyError ||
            config.models.length === 0
          }
          className="
    w-full
    border-2 border-blue-600
    bg-blue-600
    hover:bg-blue-700
    disabled:bg-transparent
    disabled:border-blue-300
    disabled:text-blue-300
    disabled:hover:bg-transparent
    disabled:cursor-not-allowed
    text-white
    font-bold
    py-4
    px-6
    rounded-xl
    shadow-lg
    shadow-blue-200
    dark:shadow-none
    transition-all
    flex
    items-center
    justify-center
    gap-2
    group
  "
        >
          {isLaunching ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Launching Benchmark...
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
              Launch Benchmark
            </>
          )}
        </button>
        {errorMessage && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-700 dark:text-red-300 font-medium">
              {errorMessage}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default ConfigDashboard;
