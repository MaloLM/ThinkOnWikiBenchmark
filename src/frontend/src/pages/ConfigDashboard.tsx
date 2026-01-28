import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Settings2,
  Globe,
  Cpu,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Star,
} from "lucide-react";
import { testApiKey, getAvailableModels } from "../services/nanogpt";
import { startBenchmark } from "../services/api";
import type { NanoGPTModel } from "../services/nanogpt";
import type { ApiKeyStatus } from "../types";
import { getFavorites, toggleFavorite, isFavorite } from "../utils/favorites";

const STORAGE_KEY = "benchmark_config";

const ConfigDashboard = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const savedConfig = JSON.parse(saved);
        return {
          apiKey: savedConfig.apiKey || "",
          models: savedConfig.models || [],
          sourcePage: savedConfig.sourcePage || "",
          targetPage: savedConfig.targetPage || "",
          maxClicks: savedConfig.maxClicks || 15,
          maxLoops: savedConfig.maxLoops || 3,
        };
      } catch (e) {
        console.error("Failed to parse saved config", e);
      }
    }
    return {
      apiKey: "",
      models: [],
      sourcePage: "",
      targetPage: "",
      maxClicks: 15,
      maxLoops: 3,
    };
  });

  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>("idle");
  const [availableModels, setAvailableModels] = useState<NanoGPTModel[]>([]);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  useEffect(() => {
    // Save the entire config including API key to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    // Load favorites on mount
    setFavorites(getFavorites());
  }, []);

  useEffect(() => {
    // Auto-test API key if it exists on mount
    if (config.apiKey.trim()) {
      handleTestApiKey();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleTestApiKey = async () => {
    if (!config.apiKey.trim()) return;

    setApiKeyStatus("testing");
    setErrorMessage("");

    try {
      const isValid = await testApiKey(config.apiKey);

      if (isValid) {
        setApiKeyStatus("valid");
        // Récupérer les modèles disponibles
        const models = await getAvailableModels(config.apiKey);
        setAvailableModels(models);
      } else {
        setApiKeyStatus("invalid");
        setErrorMessage("Invalid API key. Please check and try again.");
        setAvailableModels([]);
        setConfig({ ...config, models: [] });
      }
    } catch (error) {
      setApiKeyStatus("invalid");
      setErrorMessage("Failed to validate API key. Please try again.");
      setAvailableModels([]);
      setConfig({ ...config, models: [] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (apiKeyStatus !== "valid") {
      setErrorMessage(
        "Please validate your API key before launching the benchmark",
      );
      return;
    }

    if (config.models.length === 0) {
      setErrorMessage("Please select at least one model");
      return;
    }

    if (!config.sourcePage.trim() || !config.targetPage.trim()) {
      setErrorMessage("Please provide both source and target pages");
      return;
    }

    setIsLaunching(true);
    setErrorMessage("");

    try {
      const response = await startBenchmark({
        apiKey: config.apiKey,
        models: config.models,
        sourcePage: config.sourcePage,
        targetPage: config.targetPage,
        maxClicks: config.maxClicks,
        maxLoops: config.maxLoops,
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
            <Settings2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            API Configuration
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              NanoGPT API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => {
                  setConfig({ ...config, apiKey: e.target.value });
                  setApiKeyStatus("idle");
                  setAvailableModels([]);
                  setConfig({ ...config, apiKey: e.target.value, models: [] });
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="sk-..."
                required
              />
              <button
                type="button"
                onClick={handleTestApiKey}
                disabled={apiKeyStatus === "testing" || !config.apiKey.trim()}
                className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  apiKeyStatus === "testing"
                    ? "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                    : apiKeyStatus === "valid"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700"
                      : apiKeyStatus === "invalid"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {apiKeyStatus === "testing" && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {apiKeyStatus === "valid" && (
                  <CheckCircle className="w-4 h-4" />
                )}
                {apiKeyStatus === "invalid" && <XCircle className="w-4 h-4" />}
                {apiKeyStatus === "testing"
                  ? "Testing..."
                  : apiKeyStatus === "valid"
                    ? "Valid"
                    : apiKeyStatus === "invalid"
                      ? "Invalid"
                      : "Test API Key"}
              </button>
            </div>
            {errorMessage && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                {errorMessage}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
            <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Model Selection
          </div>

          {apiKeyStatus !== "valid" ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <p className="text-sm">
                Please validate your API key to select models
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={modelSearchQuery}
                    onChange={(e) => setModelSearchQuery(e.target.value)}
                    placeholder="Search models..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
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
                  {favorites.length > 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {favorites.length} favorite
                      {favorites.length !== 1 ? "s" : ""}
                    </span>
                  )}
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

        <div className="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200 mb-1">
            <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Wikipedia Path
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Enter the Wikipedia page titles (not URLs). Use the exact title as
            it appears in the page header.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Source Page
              </label>
              <input
                type="text"
                value={config.sourcePage}
                onChange={(e) =>
                  setConfig({ ...config, sourcePage: e.target.value })
                }
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Philosophy"
                required
              />
              <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 block">
                The starting Wikipedia article
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target Page
              </label>
              <input
                type="text"
                value={config.targetPage}
                onChange={(e) =>
                  setConfig({ ...config, targetPage: e.target.value })
                }
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Quantum mechanics"
                required
              />
              <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 block">
                The destination Wikipedia article
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
            <Settings2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Advanced Parameters
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Max Clicks: {config.maxClicks}
              </label>
              <input
                type="range"
                min="5"
                max="50"
                value={config.maxClicks}
                onChange={(e) =>
                  setConfig({ ...config, maxClicks: parseInt(e.target.value) })
                }
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Max Loops: {config.maxLoops}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={config.maxLoops}
                onChange={(e) =>
                  setConfig({ ...config, maxLoops: parseInt(e.target.value) })
                }
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={
            isLaunching ||
            apiKeyStatus !== "valid" ||
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
      </form>
    </div>
  );
};

export default ConfigDashboard;
