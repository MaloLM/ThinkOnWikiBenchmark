import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Link,
  XCircle,
  Plus,
  Upload,
  Trash,
  Dices,
} from "lucide-react";
import { startBenchmark, validateWikiUrl, getModelsFromBackend, getRandomWikiPage, getWikiPath } from "../services/api";
import Button from "../components/Button";
import ModelSelector from "../components/ModelSelector";
import WikiPairRow from "../components/WikiPairRow";
import AdvancedSettings from "../components/AdvancedSettings";

export interface NanoGPTModel {
  id: string;
  name?: string;
  created?: number;
  owned_by?: string;
}

import { getFavorites, toggleFavorite } from "../utils/favorites";
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

  const validatePath = useCallback(async (source: string, target: string, index: number) => {
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
  }, []);

  useEffect(() => {
    // Load favorites on mount
    setFavorites(getFavorites());
  }, []);

  useEffect(() => {
    // Load models on mount
    loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const loadModels = useCallback(async () => {
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
      setConfig((prev: any) => ({ ...prev, models: [] }));
    }
  }, []);

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

  const handleToggleFavorite = useCallback((modelId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(modelId);
    setFavorites(getFavorites());
  }, []);

  const toggleModel = useCallback((modelId: string) => {
    setConfig((prev: any) => {
      const newModels = prev.models.includes(modelId)
        ? prev.models.filter((m: string) => m !== modelId)
        : [...prev.models, modelId];
      return { ...prev, models: newModels };
    });
  }, []);

  const handleRandomPage = useCallback(async (type: "source" | "target", index: number) => {
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

  const clearAllPairs = () => {
    if (window.confirm("Are you sure you want to remove all pairs?")) {
      setConfig({
        ...config,
        pairs: [{ start_page: "", target_page: "" }],
      });
      setWikiPathInfo({});
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      const newPairs: { start_page: string; target_page: string }[] = [];
      
      lines.forEach((line) => {
        if (!line.trim()) return;
        // Handle both comma and semicolon
        const columns = line.split(/[;,]/);
        if (columns.length >= 2) {
          const source = columns[0].trim().replace(/^["']|["']$/g, '');
          const target = columns[1].trim().replace(/^["']|["']$/g, '');
          if (source && target && (source.startsWith('http') || target.startsWith('http'))) {
            newPairs.push({ start_page: source, target_page: target });
          }
        }
      });

      if (newPairs.length > 0) {
        const startIndex = config.pairs.length;
        const updatedPairs = [...config.pairs, ...newPairs].filter(p => p.start_page || p.target_page);
        
        setConfig({
          ...config,
          pairs: updatedPairs,
        });

        // Trigger validation for new pairs
        newPairs.forEach((pair, i) => {
          const actualIndex = startIndex + i;
          if (pair.start_page && pair.target_page) {
            validatePath(pair.start_page, pair.target_page, actualIndex);
          }
        });
      }
      
      // Reset input
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const removePair = useCallback((index: number) => {
    setConfig((prev: any) => {
      if (prev.pairs.length <= 1) return prev;
      const newPairs = prev.pairs.filter((_: any, i: number) => i !== index);
      
      // Rebuild wikiPathInfo to match new indices
      setWikiPathInfo(prevInfo => {
        const newInfo: Record<number, any> = {};
        newPairs.forEach((_: any, i: number) => {
          const oldIndex = i < index ? i : i + 1;
          if (prevInfo[oldIndex]) {
            newInfo[i] = prevInfo[oldIndex];
          }
        });
        return newInfo;
      });

      return { ...prev, pairs: newPairs };
    });
  }, []);

  // Use a ref to store timeout IDs for debounced validation per index
  const validationTimeouts = React.useRef<Record<number, any>>({});

  const updatePair = useCallback((index: number, field: "start_page" | "target_page", value: string) => {
    setConfig((prev: any) => {
      const newPairs = [...prev.pairs];
      const updatedPair = { ...newPairs[index], [field]: value };
      newPairs[index] = updatedPair;

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
        setWikiPathInfo(prevInfo => ({
          ...prevInfo,
          [index]: { length: null, loading: false, error: null }
        }));
      }

      return { ...prev, pairs: newPairs };
    });
  }, [validatePath]);

  const handleAdvancedConfigChange = useCallback((field: string, value: number) => {
    setConfig((prev: any) => ({ ...prev, [field]: value }));
  }, []);

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
        <ModelSelector
          isLoadingModels={isLoadingModels}
          apiKeyError={apiKeyError}
          availableModels={availableModels}
          selectedModels={config.models}
          modelSearchQuery={modelSearchQuery}
          setModelSearchQuery={setModelSearchQuery}
          showOnlyFavorites={showOnlyFavorites}
          setShowOnlyFavorites={setShowOnlyFavorites}
          favorites={favorites}
          toggleModel={toggleModel}
          handleToggleFavorite={handleToggleFavorite}
          loadModels={loadModels}
        />

        <div className="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200">
              <Link className="w-5 h-5 text-slate-400" />
              Wikipedia Paths
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearAllPairs}
                className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-all"
                title="Clear all pairs"
              >
                <Trash className="w-4 h-4" />
                Clear
              </button>
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-neutral-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-neutral-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-neutral-700 hover:border-slate-300 dark:hover:border-neutral-600 transition-all shadow-sm active:scale-95 cursor-pointer">
                <Upload className="w-4 h-4" />
                Import CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={addPair}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Add Pair
              </button>
            </div>
          </div>
          
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Enter the full English Wikipedia URLs for the source and target pages. You can configure multiple pairs to be processed sequentially.
          </p>

          <div className="space-y-8">
            {config.pairs.map((pair: any, index: number) => (
              <WikiPairRow
                key={index}
                index={index}
                pair={pair}
                pathInfo={wikiPathInfo[index]}
                isFetchingRandom={isFetchingRandom[index]}
                onUpdate={updatePair}
                onRemove={removePair}
                onRandomPage={handleRandomPage}
                showRemoveButton={config.pairs.length > 1}
              />
            ))}
          </div>

          <div className="mt-6 border-slate-100 dark:border-slate-700/50 flex justify-end items-center gap-3">
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

        <AdvancedSettings
          maxClicks={config.maxClicks}
          maxLoops={config.maxLoops}
          temperature={config.temperature}
          maxHallucinations={config.maxHallucinations}
          onConfigChange={handleAdvancedConfigChange}
        />

        <Button
          type="submit"
          disabled={
            isLaunching ||
            isLoadingModels ||
            !!apiKeyError ||
            config.models.length === 0
          }
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isLaunching}
          icon={!isLaunching && <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />}
        >
          {isLaunching ? "Launching Benchmark..." : "Launch Benchmark"}
        </Button>
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
