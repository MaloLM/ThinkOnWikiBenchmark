import React, { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Terminal, Wifi, WifiOff, Bot, Check, X, Loader2, ChevronDown, StopCircle, LocateFixed, Expand, ChevronLeft, Plus, Minus } from 'lucide-react';
import Graph from '../components/Graph';
import type { GraphHandle } from '../components/Graph';
import { useLiveMonitoring } from '../hooks/useLiveMonitoring';
import { ReadyState } from 'react-use-websocket';
import { stopBenchmark } from '../services/api';

const LiveMonitoring = () => {
  const { run_id } = useParams();
  const navigate = useNavigate();
  
  // Handle run completion and redirect
  const handleRunCompleted = useCallback((completedRunId: string) => {
    console.log('Run completed, redirecting to archive:', completedRunId);
    navigate(`/archives/${completedRunId}`);
  }, [navigate]);
  
  const monitoringState = useLiveMonitoring(run_id, handleRunCompleted);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = React.useState(false);
  const [isStoppingBenchmark, setIsStoppingBenchmark] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);
  const graphRef = useRef<GraphHandle>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelSelectorOpen(false);
      }
    };

    if (isModelSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelSelectorOpen]);
  
  const { nodes, links, logs, currentModel, selectedModel, modelProgress, connectionState, allModels, selectModel, startPage, targetPage } = monitoringState;

  // Debug logging
  console.log('🎯 LiveMonitoring Render:', {
    currentModel,
    selectedModel,
    nodesCount: nodes.length,
    linksCount: links.length,
    allModelsCount: allModels.length,
    modelProgress
  });

  const handleStopBenchmark = async () => {
    if (!run_id || isStoppingBenchmark || stopRequested) return;
    
    if (!confirm('Are you sure you want to stop this benchmark?')) {
      return;
    }
    
    setIsStoppingBenchmark(true);
    try {
      await stopBenchmark(run_id);
      setStopRequested(true);
    } catch (error) {
      console.error('Error stopping benchmark:', error);
      alert('Error stopping benchmark');
    } finally {
      setIsStoppingBenchmark(false);
    }
  };

  const getConnectionStatus = () => {
    switch (connectionState) {
      case ReadyState.CONNECTING:
        return { text: 'Connecting...', color: 'text-yellow-500', icon: Wifi };
      case ReadyState.OPEN:
        return { text: 'Connected', color: 'text-green-500', icon: Wifi };
      case ReadyState.CLOSING:
        return { text: 'Closing...', color: 'text-yellow-500', icon: WifiOff };
      case ReadyState.CLOSED:
        return { text: 'Disconnected', color: 'text-red-500', icon: WifiOff };
      default:
        return { text: 'Not connected', color: 'text-slate-400', icon: WifiOff };
    }
  };

  const connectionStatus = getConnectionStatus();

  // Get status info for a model
  const getModelStatusInfo = (status: 'running' | 'completed' | 'failed' | null) => {
    switch (status) {
      case 'running':
        return { icon: Loader2, color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'Running', iconClass: 'animate-spin' };
      case 'completed':
        return { icon: Check, color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'Completed', iconClass: '' };
      case 'failed':
        return { icon: X, color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Failed', iconClass: '' };
      default:
        return { icon: Clock, color: 'text-slate-400', bgColor: 'bg-slate-400/10', label: 'Waiting', iconClass: '' };
    }
  };

  const selectedModelData = allModels.find(m => m.modelId === selectedModel);
  const selectedModelStatus = selectedModelData ? getModelStatusInfo(selectedModelData.status) : null;

  return (
    <div className="space-y-6">
      {/* Header with Title, UUID, Dropdown and Stats */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        {/* Left: Title and UUID */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/config')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-400"
            title="Back to Config"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Live Monitoring
            </h1>
            <p className="text-slate-600 dark:text-slate-400 font-mono text-sm">
              {run_id}
            </p>
          </div>
        </div>

        {/* Right: Model Selector and Stats */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Dropdown Selector */}
          {allModels.length > 0 && (
            <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
                  className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors min-w-[280px]"
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {selectedModel || 'Select a model'}
                      </span>
                    </div>
                    {selectedModelStatus && (
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`flex items-center gap-1 text-xs font-medium ${selectedModelStatus.color}`}>
                          <selectedModelStatus.icon className={`w-3 h-3 ${selectedModelStatus.iconClass}`} />
                          {selectedModelStatus.label}
                        </span>
                        {selectedModelData && (
                          <>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {selectedModelData.metrics.clicks} clicks
                            </span>
                            {selectedModelData.metrics.hallucinations > 0 && (
                              <span className="text-xs text-red-500 dark:text-red-400">
                                {selectedModelData.metrics.hallucinations} hallucinations
                              </span>
                            )}
                          </>
                        )}
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
                    {allModels.map((model) => {
                      const statusInfo = getModelStatusInfo(model.status);
                      const isSelected = model.modelId === selectedModel;
                      const isCurrentlyRunning = model.modelId === currentModel;
                      
                      return (
                        <button
                          key={model.modelId}
                          onClick={() => {
                            selectModel(model.modelId);
                            setIsModelSelectorOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            isSelected
                              ? "bg-blue-50 dark:bg-blue-900/20"
                              : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${isSelected ? "bg-blue-600" : "bg-transparent"}`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-white"}`}>
                                {model.modelId}
                              </span>
                              {isCurrentlyRunning && (
                                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                                  Live
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className={`flex items-center gap-1 text-xs font-medium ${statusInfo.color}`}>
                                <statusInfo.icon className={`w-3 h-3 ${statusInfo.iconClass}`} />
                                {statusInfo.label}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {model.metrics.clicks} clicks
                              </span>
                              {model.metrics.hallucinations > 0 && (
                                <span className="text-xs text-red-500 dark:text-red-400">
                                  {model.metrics.hallucinations} hallucinations
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
            </div>
          )}

          {/* Stats and Connection Status */}
          <div className="flex items-center gap-6 text-sm">
            {modelProgress.total > 0 && (
              <div className="text-center">
                <span className="block text-xs text-slate-500 dark:text-slate-400 uppercase">
                  Progress
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {modelProgress.current} / {modelProgress.total}
                </span>
              </div>
            )}
            <div className="text-center">
              <span className="block text-xs text-slate-500 dark:text-slate-400 uppercase">
                Status
              </span>
              <span className={`font-bold ${connectionStatus.color}`}>
                {connectionStatus.text}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Currently Running Model Banner */}
      {currentModel && (
        <div className="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg border border-blue-200 dark:border-blue-700">
              <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <div className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wider">
                  Currently Running
                </div>
                <div className="text-lg font-bold text-blue-900 dark:text-blue-100">
                  {currentModel}
                </div>
              </div>
              <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <button
              onClick={handleStopBenchmark}
              disabled={isStoppingBenchmark || stopRequested}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                stopRequested
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-700 cursor-not-allowed'
                  : isStoppingBenchmark
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700 cursor-wait'
                  : 'bg-red-500 hover:bg-red-600 text-white border border-red-600 hover:border-red-700'
              }`}
            >
              {isStoppingBenchmark ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Stopping...
                </>
              ) : stopRequested ? (
                <>
                  <Clock className="w-4 h-4" />
                  Stop Requested
                </>
              ) : (
                <>
                  <StopCircle className="w-4 h-4" />
                  Stop
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {!currentModel && allModels.length === 0 && (
        <div className="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <Clock className="w-5 h-5 text-slate-400" />
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Waiting for benchmark to start...
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-20rem)] gap-6">
        {/* Main Graph Area */}
        <div className="flex-1 flex flex-col gap-4 min-h-[400px] lg:min-h-0">
          <div className="flex-1 relative bg-white dark:bg-neutral-800 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <Graph ref={graphRef} nodes={nodes} links={links} />
          {/* Graph Title and Control Buttons */}
          <div className="absolute top-3 left-3 right-3 flex flex-wrap items-start justify-between gap-2 z-10">
            {/* Title */}
            {startPage && targetPage && (
              <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {startPage} → {targetPage}
                </h3>
              </div>
            )}
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
          <div className="absolute bottom-4 left-4 bg-white/80 dark:bg-neutral-800/80 backdrop-blur p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-2 shadow-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" /> Start Node
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" /> Target Node
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" /> Current Position
            </div>
          </div>
          </div>
        </div>

        {/* Side Panel: Logs */}
        <div className="w-full lg:w-96 flex flex-col gap-4 h-[400px] lg:h-auto">
          <div className="flex-1 bg-black rounded-xl border border-slate-700 shadow-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center gap-2 font-bold text-xs text-white uppercase tracking-wider" style={{ fontFamily: "'Courier New', 'Consolas', 'Monaco', monospace" }}>
            <Terminal className="w-4 h-4" />
            Real-time Logs
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs" style={{ fontFamily: "'Courier New', 'Consolas', 'Monaco', monospace" }}>
            {logs.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                <p>Waiting for events...</p>
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`space-y-1 border-l-2 pl-3 ml-1 ${
                  log.type === 'success' ? 'border-green-500' : 
                  log.type === 'error' ? 'border-red-500' : 
                  log.type === 'warning' ? 'border-yellow-500' :
                  'border-slate-600'
                }`}>
                  <div className="flex justify-between text-green-500">
                    <span>[{log.timestamp}]</span>
                    <span className="text-green-500">{log.model}</span>
                  </div>
                  <div className={`${
                    log.type === 'success' ? 'text-white' : 
                    log.type === 'error' ? 'text-red-400' : 
                    log.type === 'warning' ? 'text-yellow-400' :
                    'text-white'
                  }`}>
                    {log.message}
                  </div>
                </div>
              ))
            )}
            </div>
          </div>
        </div>
      </div>

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
              {startPage && targetPage && (
                <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 shadow-lg">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {startPage} → {targetPage}
                  </h3>
                </div>
              )}
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
            {/* Legend in Fullscreen */}
            <div className="absolute bottom-4 left-4 bg-white/80 dark:bg-neutral-800/80 backdrop-blur p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-2 shadow-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" /> Start Node
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" /> Target Node
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" /> Current Position
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMonitoring;
