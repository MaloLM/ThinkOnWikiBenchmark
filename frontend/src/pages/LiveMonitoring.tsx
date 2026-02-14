import React, { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Terminal, Wifi, WifiOff, Check, X, Loader2, ChevronDown, StopCircle, LocateFixed, Expand, ChevronLeft, Plus, Minus, Link as LinkIcon, ExternalLink } from 'lucide-react';
import Graph from '../components/Graph';
import type { GraphHandle } from '../components/Graph';
import { useLiveMonitoring } from '../hooks/useLiveMonitoring';
import { ReadyState } from 'react-use-websocket';
import { stopBenchmark } from '../services/api';
import { cleanModelName } from '../utils/format';
import Button from '../components/Button';

const LiveMonitoring = () => {
  const { run_id } = useParams();
  const navigate = useNavigate();
  
  const handleRunCompleted = useCallback((completedRunId: string) => {
    navigate(`/archives/${completedRunId}`);
  }, [navigate]);
  
  const monitoringState = useLiveMonitoring(run_id, handleRunCompleted);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = React.useState(false);
  const [isPairSelectorOpen, setIsPairSelectorOpen] = React.useState(false);
  const [isStoppingBenchmark, setIsStoppingBenchmark] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const graphRef = useRef<GraphHandle>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const pairDropdownRef = useRef<HTMLDivElement>(null);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelSelectorOpen(false);
      }
      if (pairDropdownRef.current && !pairDropdownRef.current.contains(event.target as Node)) {
        setIsPairSelectorOpen(false);
      }
    };

    if (isModelSelectorOpen || isPairSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelSelectorOpen, isPairSelectorOpen]);
  
  const { nodes, links, logs, currentModel, selectedModel, selectedPairIndex, modelProgress, connectionState, allModels, selectModel, selectPair, pairs, startPage, targetPage } = monitoringState;

  const totalTasks = modelProgress.totalTasks || (pairs.length * modelProgress.total);
  const completedTasks = modelProgress.completed + modelProgress.failed;
  const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const successPercentage = totalTasks > 0 ? (modelProgress.completed / totalTasks) * 100 : 0;
  const failurePercentage = totalTasks > 0 ? (modelProgress.failed / totalTasks) * 100 : 0;

  const modelsForCurrentPair = allModels.filter(m => m.pairIndex === selectedPairIndex);

  const handleStopBenchmark = async () => {
    if (!run_id || isStoppingBenchmark || stopRequested) return;
    if (!confirm('Are you sure you want to stop this benchmark?')) return;
    
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
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
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
              <div className="flex items-center gap-2">
                <p className="text-slate-600 dark:text-slate-400 font-mono text-sm">
                  {run_id}
                </p>
                <button
                  onClick={handleCopyUrl}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <LinkIcon className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            {pairs.length > 0 && (
              <div className="text-center">
                <span className="block text-xs text-slate-500 dark:text-slate-400 uppercase">Pairs</span>
                <span className="font-bold text-slate-900 dark:text-white">{pairs.length}</span>
              </div>
            )}
            {modelProgress.total > 0 && (
              <div className="text-center">
                <span className="block text-xs text-slate-500 dark:text-slate-400 uppercase">Models</span>
                <span className="font-bold text-slate-900 dark:text-white">{modelProgress.current} / {modelProgress.total}</span>
              </div>
            )}
            <div className="text-center">
              <span className="block text-xs text-slate-500 dark:text-slate-400 uppercase">Status</span>
              <span className={`font-bold ${connectionStatus.color}`}>{connectionStatus.text}</span>
            </div>
          </div>
        </div>
      </div>

      {totalTasks > 0 && (
        <div className="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white">Overall Progress</span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{completedTasks} / {totalTasks} tasks</span>
            </div>
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{Math.round(progressPercentage)}%</span>
          </div>
          <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
            <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${successPercentage}%` }} />
            <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${failurePercentage}%` }} />
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {currentModel ? (
            <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg border border-blue-200 dark:border-blue-700">
              <div>
                <div className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wider">Currently Running</div>
                <div className="text-base font-bold text-blue-900 dark:text-blue-100">{cleanModelName(currentModel)}</div>
              </div>
              <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <Clock className="w-5 h-5 text-slate-400" />
              <div className="text-sm text-slate-500 dark:text-slate-400">Waiting for benchmark to start...</div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 justify-center">
            {pairs.length > 0 && (
              <div className="relative" ref={pairDropdownRef}>
                <button
                  onClick={() => setIsPairSelectorOpen(!isPairSelectorOpen)}
                  className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors min-w-[320px]"
                >
                  <div className="flex-1 text-left">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pair</div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      #{selectedPairIndex + 1}: {pairs[selectedPairIndex].start_page.split('/').pop()} → {pairs[selectedPairIndex].target_page.split('/').pop()}
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isPairSelectorOpen ? "rotate-180" : ""}`} />
                </button>
                {isPairSelectorOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg z-20 overflow-hidden">
                    {pairs.map((pair, idx) => (
                      <button
                        key={idx}
                        onClick={() => { selectPair(idx); setIsPairSelectorOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${idx === selectedPairIndex ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
                      >
                        <div className={`w-2 h-2 rounded-full ${idx === selectedPairIndex ? "bg-blue-600" : "bg-transparent"}`} />
                        <div className="flex-1">
                          <span className={`font-medium ${idx === selectedPairIndex ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-white"}`}>
                            #{idx + 1}: {pair.start_page.split('/').pop()} → {pair.target_page.split('/').pop()}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {modelsForCurrentPair.length > 0 && (
              <div className="relative" ref={modelDropdownRef}>
                <button
                  onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
                  className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors min-w-[240px]"
                >
                  <div className="flex-1 text-left">
                    <span className="font-semibold text-slate-900 dark:text-white">{selectedModel ? cleanModelName(selectedModel) : 'Select a model'}</span>
                    {selectedModelStatus && (
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className={`flex items-center gap-1 text-[10px] font-medium ${selectedModelStatus.color}`}>
                          <selectedModelStatus.icon className={`w-2.5 h-2.5 ${selectedModelStatus.iconClass}`} />
                          {selectedModelStatus.label}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isModelSelectorOpen ? "rotate-180" : ""}`} />
                </button>
                {isModelSelectorOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg z-20 overflow-hidden">
                    {modelsForCurrentPair.map((model) => (
                      <button
                        key={model.modelId}
                        onClick={() => { selectModel(model.modelId); setIsModelSelectorOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${model.modelId === selectedModel ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}
                      >
                        <div className={`w-2 h-2 rounded-full ${model.modelId === selectedModel ? "bg-blue-600" : "bg-transparent"}`} />
                        <div className="flex-1">
                          <span className={`font-medium ${model.modelId === selectedModel ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-white"}`}>
                            {cleanModelName(model.modelId)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Button
            onClick={handleStopBenchmark}
            disabled={isStoppingBenchmark || stopRequested}
            variant={stopRequested ? 'secondary' : 'danger'}
            isLoading={isStoppingBenchmark}
            icon={!isStoppingBenchmark && (stopRequested ? <Clock className="w-4 h-4" /> : <StopCircle className="w-4 h-4" />)}
          >
            {isStoppingBenchmark ? 'Stopping...' : (stopRequested ? 'Stop Requested' : 'Stop')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-20rem)] gap-6">
        <div className="flex-1 flex flex-col gap-4 min-h-[400px] lg:min-h-0">
          <div className="flex-1 relative bg-white dark:bg-neutral-800 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <Graph ref={graphRef} nodes={nodes} links={links} />
            <div className="absolute top-3 left-3 right-3 flex flex-wrap items-start justify-between gap-2 z-10">
              {startPage && targetPage && (
                <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{startPage}</span>
                    <span className="text-slate-400">→</span>
                    <span>{targetPage}</span>
                  </h3>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => graphRef.current?.zoomIn()} className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm"><Plus className="w-4 h-4" /></button>
                <button onClick={() => graphRef.current?.zoomOut()} className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm"><Minus className="w-4 h-4" /></button>
                <button onClick={() => graphRef.current?.resetView()} className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm"><LocateFixed className="w-4 h-4" /></button>
                <button onClick={() => setIsGraphFullscreen(true)} className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm"><Expand className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-96 flex flex-col gap-4 h-[400px] lg:h-auto">
          <div className="flex-1 bg-black rounded-xl border border-slate-700 shadow-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center gap-2 font-bold text-xs text-white uppercase tracking-wider">
              <Terminal className="w-4 h-4" /> Real-time Logs
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono">
              {logs.length === 0 ? (
                <div className="text-center text-slate-400 py-8">Waiting for events...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`space-y-1 border-l-2 pl-3 ml-1 ${log.type === 'success' ? 'border-green-500' : log.type === 'error' ? 'border-red-500' : 'border-slate-600'}`}>
                    <div className="flex justify-between text-green-500">
                      <span>[{log.timestamp}]</span>
                      <span>{log.model}</span>
                    </div>
                    <div className="text-white">{log.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {isGraphFullscreen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-8" onClick={() => setIsGraphFullscreen(false)}>
          <div className="relative w-full h-full bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <Graph ref={graphRef} nodes={nodes} links={links} />
            <button onClick={() => setIsGraphFullscreen(false)} className="absolute top-4 right-4 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-lg"><X className="w-5 h-5" /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMonitoring;
