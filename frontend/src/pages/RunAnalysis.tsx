import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  History,
  MessageSquare,
  ChevronRight,
  Info,
  ChevronDown,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Lightbulb,
  LocateFixed,
  Expand,
  ChevronLeft,
  Terminal,
  Plus,
  Minus,
  Link as LinkIcon,
  ExternalLink,
} from "lucide-react";
import Graph from "../components/Graph";
import type { GraphHandle } from "../components/Graph";
import type { WikiNode, WikiLink, BenchmarkStep } from "../types";
import { getArchiveDetails } from "../services/api";
import type { ArchiveDetails } from "../services/api";
import PromptModal from "../components/PromptModal";
import { cleanModelName } from "../utils/format";

// Type for model data in a run
interface ModelRunData {
  modelId: string;
  modelName: string;
  provider: string;
  status: "completed" | "failed" | "lost" | "loop_detected";
  steps: BenchmarkStep[];
  finalMetrics: {
    totalClicks: number;
    efficiencyRatio: number;
    hallucinationCount: number;
    totalTimeMs: number;
  };
}

const RunAnalysis = () => {
  const { run_id } = useParams();
  const navigate = useNavigate();
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [selectedPairIndex, setSelectedPairIndex] = useState(0);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiveData, setArchiveData] = useState<ArchiveDetails | null>(null);
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const graphRef = useRef<GraphHandle>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsModelSelectorOpen(false);
      }
    };

    if (isModelSelectorOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isModelSelectorOpen]);

  useEffect(() => {
    if (run_id) {
      loadArchiveData();
    }
  }, [run_id]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadArchiveData = async () => {
    if (!run_id) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await getArchiveDetails(run_id);
      setArchiveData(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load archive details",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Transform backend data to frontend format
  const modelsData: ModelRunData[] = archiveData
    ? Object.entries(
        archiveData.pairs?.[selectedPairIndex]?.models || archiveData.models
      ).map(([modelId, modelData]) => {
        const metrics = modelData?.metrics;
        const steps = modelData?.steps || [];

        return {
          modelId,
          modelName: cleanModelName(modelId.split("/").pop() || modelId),
          provider: modelId.split("/")[0] || "Unknown",
          status: metrics?.status === "success" ? "completed" : "failed",
          steps: steps.map((step) => ({
            timestamp: step.timestamp
              ? new Date(step.timestamp * 1000).toLocaleTimeString("en-US")
              : "N/A",
            nodeId: `node_${step.page_title}`,
            title: step.page_title || "Unknown Page",
            action: step.is_final_target
              ? "Target reached!"
              : step.next_page_title
                ? `Clicked link to "${step.next_page_title}"`
                : "Analyzing page",
            prompt: step.is_final_target
              ? `Target page reached: ${step.page_title}`
              : `Current page: ${step.page_title}`,
            sent_prompt: step.sent_prompt,
            response:
              step.llm_response?.content ||
              (step.is_final_target
                ? "Successfully reached the target page!"
                : ""),
            intuition: step.intuition || step.llm_response?.intuition,
            metrics: {
              clicks: step.step ?? 0,
              hallucinations: 0, // Calculated cumulatively below
              time: Math.round((step.llm_duration ?? 0) * 1000), // Convert seconds to milliseconds
            },
          })),
          finalMetrics: {
            totalClicks: metrics?.total_steps ?? 0,
            efficiencyRatio:
              (metrics?.total_steps ?? 0) >= 0
                ? 1 - (metrics?.hallucination_rate ?? 0)
                : 0,
            hallucinationCount: metrics?.hallucination_count || 0,
            totalTimeMs: Math.round((metrics?.total_duration ?? 0) * 1000),
          },
        };
      })
    : [];

  const selectedModel = modelsData[selectedModelIndex];
  const steps = selectedModel?.steps || [];

  // Initialize currentStep to the last step by default
  const [currentStep, setCurrentStep] = useState(
    steps.length > 0 ? steps.length - 1 : 0,
  );

  // Function to change model
  const handleModelChange = (index: number) => {
    setSelectedModelIndex(index);
    setCurrentStep(modelsData[index].steps.length - 1); // Set to last step when changing model
    setIsModelSelectorOpen(false);
  };

  // Helper to get status icon and color
  const getStatusInfo = (status: ModelRunData["status"]) => {
    switch (status) {
      case "completed":
        return {
          icon: Check,
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          label: "Completed",
        };
      case "failed":
        return {
          icon: X,
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          label: "Failed",
        };
      case "lost":
        return {
          icon: AlertTriangle,
          color: "text-amber-500",
          bgColor: "bg-amber-500/10",
          label: "Lost",
        };
      case "loop_detected":
        return {
          icon: AlertTriangle,
          color: "text-orange-500",
          bgColor: "bg-orange-500/10",
          label: "Loop",
        };
    }
  };

  // Create nodes with step numbers, handling nodes visited multiple times
  const nodeMap = new Map<string, WikiNode>();
  const isLastStepSuccess = selectedModel?.status === "completed";
  const lastStepIndex = steps.length - 1;

  steps.forEach((s, i) => {
    const stepNumber = i + 1;
    const isCurrentStep = i === currentStep;
    const isLastStep = i === lastStepIndex;
    const isStartNode = i === 0;

    if (nodeMap.has(s.nodeId)) {
      // Node already exists, add step number
      const existingNode = nodeMap.get(s.nodeId)!;
      existingNode.steps = [...(existingNode.steps || []), stepNumber];
      // Update type if it's the current step
      if (isCurrentStep) {
        if (isStartNode) {
          existingNode.type = "current";
        } else if (isLastStep) {
          // If it's the last step, apply success/failure logic
          existingNode.type = isLastStepSuccess ? "target" : "failed";
        } else {
          existingNode.type = "current";
        }
      }
    } else {
      // New node - determine its type
      let nodeType: WikiNode["type"];
      if (isStartNode) {
        // The start node has the blue ring only when focused (currentStep === 0)
        nodeType = isCurrentStep ? "current" : "start";
      } else if (isCurrentStep) {
        // If it's the current step AND the last step, apply conditional coloring
        if (isLastStep) {
          nodeType = isLastStepSuccess ? "target" : "failed";
        } else {
          nodeType = "current";
        }
      } else if (i <= currentStep) {
        nodeType = "visited";
      } else {
        // Future nodes (after current step)
        nodeType = "visited";
      }

      nodeMap.set(s.nodeId, {
        id: s.nodeId,
        title: s.title,
        type: nodeType,
        steps: [stepNumber],
      });
    }
  });

  const nodes: WikiNode[] = Array.from(nodeMap.values());

  // Create links between nodes
  const links: WikiLink[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    const sourceNode = nodeMap.get(steps[i].nodeId);
    const targetNode = nodeMap.get(steps[i + 1].nodeId);
    if (sourceNode && targetNode) {
      links.push({
        source: sourceNode.id,
        target: targetNode.id,
        type: "normal",
      });
    }
  }

  const activeStep = steps[currentStep];

  const currentStatusInfo = selectedModel
    ? getStatusInfo(selectedModel.status)
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">
            Loading archive details...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Archive Error
          </h2>
          <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            This archive may be corrupted or unreadable. The data might have
            been damaged during the benchmark run or storage.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={loadArchiveData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Loader2 className="w-4 h-4" />
              Retry
            </button>
            <button
              onClick={() => (window.location.href = "/archives")}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Back to Archives
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!archiveData || modelsData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <p>No data available for this run.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Title, UUID, Dropdown and Stats */}
      <div className="flex flex-col gap-4">
        {/* Line 1: Title, UUID and Stats */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Title and UUID */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/archives")}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-400"
              title="Back to Archives"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Run Analysis
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-slate-600 dark:text-slate-400 font-mono text-sm">
                  {run_id}
                </p>
                <button
                  onClick={handleCopyUrl}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                  title="Copy Page URL"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <LinkIcon className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right: Quick Stats */}
          <div className="flex items-center gap-6 text-sm">
            {archiveData?.config.pairs && (
              <div className="text-center">
                <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                  Pairs
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {archiveData.config.pairs.length}
                </span>
              </div>
            )}
            <div className="text-center">
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                Models
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {modelsData.length}
              </span>
            </div>
            <div className="text-center">
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                Completed
              </span>
              <span className="font-bold text-green-600 dark:text-green-400">
                {modelsData.filter((m) => m.status === "completed").length}
              </span>
            </div>
            <div className="text-center">
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                Failed
              </span>
              <span className="font-bold text-red-600 dark:text-red-400">
                {modelsData.filter((m) => m.status === "failed").length}
              </span>
            </div>
          </div>
        </div>

        {/* Line 2: Selectors */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Pair Selector */}
          {archiveData?.config.pairs && archiveData.config.pairs.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pair</span>
              <select
                value={selectedPairIndex}
                onChange={(e) => {
                  setSelectedPairIndex(parseInt(e.target.value));
                  setSelectedModelIndex(0);
                  setCurrentStep(0);
                }}
                className="bg-transparent text-sm font-semibold text-slate-900 dark:text-white outline-none cursor-pointer"
              >
                {archiveData.config.pairs.map((pair, idx) => (
                  <option key={idx} value={idx}>
                    #{idx + 1}: {pair.start_page.split('/').pop()} → {pair.target_page.split('/').pop()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dropdown Selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
              className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors min-w-[280px]"
            >
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedModel.modelName}
                  </span>
                </div>
                {currentStatusInfo && (
                  <div className="flex items-center gap-3 mt-1">
                    <span
                      className={`flex items-center gap-1 text-xs font-medium ${currentStatusInfo.color}`}
                    >
                      <currentStatusInfo.icon className="w-3 h-3" />
                      {currentStatusInfo.label}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedModel.finalMetrics.totalClicks} clicks
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {Math.round(
                        selectedModel.finalMetrics.efficiencyRatio * 100,
                      )}
                      % efficiency
                    </span>
                  </div>
                )}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${isModelSelectorOpen ? "rotate-180" : ""}`}
              />
            </button>

            {/* Dropdown Menu */}
            {isModelSelectorOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg z-20 overflow-hidden">
                {modelsData.map((model, index) => {
                  const statusInfo = getStatusInfo(model.status);
                  const isSelected = index === selectedModelIndex;
                  return (
                    <button
                      key={model.modelId}
                      onClick={() => handleModelChange(index)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${isSelected ? "bg-blue-600" : "bg-transparent"}`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-white"}`}
                          >
                            {model.modelName}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span
                            className={`flex items-center gap-1 text-xs font-medium ${statusInfo.color}`}
                          >
                            <statusInfo.icon className="w-3 h-3" />
                            {statusInfo.label}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {model.finalMetrics.totalClicks} clicks
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {Math.round(
                              model.finalMetrics.efficiencyRatio * 100,
                            )}
                            %
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline Slider */}
      <div className="bg-white dark:bg-neutral-800 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Dynamic Step Title - Left Aligned */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Step {currentStep + 1}/{steps.length}: {activeStep?.title || ""}
          </h3>
        </div>

        <input
          type="range"
          min="0"
          max={steps.length - 1}
          value={currentStep}
          onChange={(e) => setCurrentStep(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="relative mt-4 pb-3">
          {steps.map((step, i) => {
            // Determine color based on step status
            let stepColor = "";
            if (i === lastStepIndex && isLastStepSuccess) {
              // Final step success - green
              stepColor = "text-green-600 dark:text-green-400";
            } else if (i === lastStepIndex && !isLastStepSuccess) {
              // Final step failed - red
              stepColor = "text-red-600 dark:text-red-400";
            } else if (i === currentStep) {
              // Current step - orange
              stepColor = "text-orange-600 dark:text-orange-400";
            } else {
              // Other steps - blue
              stepColor = "text-blue-600 dark:text-blue-400";
            }

            // Calculate position to align with slider
            const position =
              steps.length > 1 ? (i / (steps.length - 1)) * 100 : 50;

            return (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className="absolute flex flex-col items-center gap-1 group -translate-x-1/2"
                style={{ left: `${position}%` }}
              >
                <span
                  className={`text-sm font-bold ${stepColor} transition-all ${i === currentStep ? "scale-125" : ""}`}
                >
                  {i + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 relative min-h-[400px] lg:min-h-[600px] bg-white dark:bg-neutral-800 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <Graph ref={graphRef} nodes={nodes} links={links} />
          {/* Graph Title and Control Buttons */}
          <div className="absolute top-3 left-3 right-3 flex flex-wrap items-start justify-between gap-2 z-10">
            {/* Title */}
          <div className="flex items-center gap-2">
            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {archiveData?.config.pairs?.[selectedPairIndex]?.start_page || (archiveData?.config as any).start_page} →{" "}
                {archiveData?.config.pairs?.[selectedPairIndex]?.target_page || (archiveData?.config as any).target_page}
              </h3>
            </div>
              {activeStep && (
                <a
                  href={`https://en.wikipedia.org/wiki/${encodeURIComponent(activeStep.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm transition-colors flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                  title={`Open "${activeStep.title}" on Wikipedia`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Wikipedia</span>
                </a>
              )}
            </div>
            {/* Control Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => graphRef.current?.zoomIn()}
                className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm transition-colors"
                title="Zoom in"
              >
                <Plus className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
              <button
                onClick={() => graphRef.current?.zoomOut()}
                className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm transition-colors"
                title="Zoom out"
              >
                <Minus className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
              <button
                onClick={() => graphRef.current?.resetView()}
                className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm transition-colors"
                title="Reset view"
              >
                <LocateFixed className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
              <button
                onClick={() => setIsGraphFullscreen(true)}
                className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm transition-colors"
                title="Fullscreen"
              >
                <Expand className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-96 space-y-4">
          {/* Step Navigation Controls */}
          <div className="flex items-center justify-center gap-4 bg-white dark:bg-neutral-800 p-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors disabled:opacity-30 text-slate-600 dark:text-slate-400"
              disabled={currentStep === 0}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 px-4 border-x border-slate-100 dark:border-slate-800">
              <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Step {currentStep + 1} / {steps.length}
              </span>
            </div>
            <button
              onClick={() =>
                setCurrentStep(Math.min(steps.length - 1, currentStep + 1))
              }
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors disabled:opacity-30 text-slate-600 dark:text-slate-400"
              disabled={currentStep === steps.length - 1}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-white dark:bg-neutral-800 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Step Details
            </h3>
            <div className="space-y-3">
              <div>
                <span className="block text-xs text-slate-400 dark:text-slate-500 font-bold uppercase">
                  Current Page
                </span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {activeStep.title}
                </span>
              </div>
              <div>
                <span className="block text-xs text-slate-400 dark:text-slate-500 font-bold uppercase">
                  Action
                </span>
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {activeStep.action}
                </span>
              </div>
              {selectedModel.status === "failed" && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg">
                  <span className="block text-xs text-red-600 dark:text-red-400 font-bold uppercase mb-1">
                    Failure Reason
                  </span>
                  <span className="text-sm text-red-700 dark:text-red-300">
                    {archiveData?.models[selectedModel.modelId]?.metrics
                      ?.reason || "Unknown error occurred during the run."}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50 dark:border-slate-800">
                <div>
                  <span className="block text-xs text-slate-400 dark:text-slate-500 font-bold uppercase">
                    Time
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {activeStep.metrics.time}ms
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-400 dark:text-slate-500 font-bold uppercase">
                    Total Clicks
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {activeStep.metrics.clicks}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-800 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />{" "}
                    Current Page
                  </h4>
                </div>
                <button
                  onClick={() => setIsPromptModalOpen(true)}
                  className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded border border-blue-100 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  <Terminal className="w-3 h-3" />
                  View Full Prompt
                </button>
              </div>
              {activeStep.intuition && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />{" "}
                    Intuition
                  </h4>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 p-3 rounded text-xs text-yellow-900 dark:text-yellow-100 leading-relaxed max-h-32 overflow-y-auto font-mono">
                    {activeStep.intuition}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Prompt Modal */}
      <PromptModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        messages={activeStep?.sent_prompt}
        title={`${activeStep?.title} (Step ${currentStep + 1})`}
      />

      {/* Fullscreen Graph Modal */}
      {isGraphFullscreen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-8"
          onClick={() => setIsGraphFullscreen(false)}
        >
          <div
            className="relative w-full h-full bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <Graph ref={graphRef} nodes={nodes} links={links} />
            {/* Title and Control Buttons in Fullscreen */}
            <div className="absolute top-4 left-4 right-4 flex flex-wrap items-start justify-between gap-2 z-10">
            {/* Title */}
            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 shadow-lg">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {archiveData?.config.pairs?.[selectedPairIndex]?.start_page || (archiveData?.config as any).start_page} →{" "}
                {archiveData?.config.pairs?.[selectedPairIndex]?.target_page || (archiveData?.config as any).target_page}
              </h3>
            </div>
              {/* Control Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => graphRef.current?.zoomIn()}
                  className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 shadow-lg transition-colors"
                  title="Zoom in"
                >
                  <Plus className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
                <button
                  onClick={() => graphRef.current?.zoomOut()}
                  className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 shadow-lg transition-colors"
                  title="Zoom out"
                >
                  <Minus className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
                <button
                  onClick={() => graphRef.current?.resetView()}
                  className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 shadow-lg transition-colors"
                  title="Reset view"
                >
                  <LocateFixed className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
                <button
                  onClick={() => setIsGraphFullscreen(false)}
                  className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 shadow-lg transition-colors"
                  title="Close fullscreen"
                >
                  <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunAnalysis;
