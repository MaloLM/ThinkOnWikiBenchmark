/**
 * Hook pour gérer le WebSocket de monitoring en temps réel
 */

import { useState, useEffect, useCallback } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { WS_BASE_URL } from '../config';
import type { WikiNode, WikiLink } from '../types';

interface StepEvent {
  type: 'step';
  run_id: string;
  model_id: string;
  data: {
    step: number;
    page_title: string;
    next_page_title?: string;
    llm_duration: number;
    timestamp: number;
    next_concept_id?: string;
    mapping: Record<string, string>;
    is_hallucination?: boolean;
    available_concepts_count?: number;
    use_langchain?: boolean;
    structured_parsing_success?: boolean;
    parsing_method?: string;
    confidence?: number;
  };
}

interface HallucinationEvent {
  type: 'hallucination';
  run_id: string;
  model_id: string;
  data: {
    step: number;
    page_title: string;
    invalid_concept_id: string;
    available_concepts: string[];
  };
}

interface RunCreatedEvent {
  type: 'run_created';
  run_id: string;
  message: string;
  start_page: string;
  target_page: string;
  total_models: number;
}

interface ReadyToStartEvent {
  type: 'ready_to_start';
  run_id: string;
  message: string;
}

interface RunStartEvent {
  type: 'run_start';
  run_id: string;
  total_models: number;
  total_pairs?: number;
  pairs?: { start_page: string; target_page: string }[];
  start_page: string;
  target_page: string;
}

interface ModelStartEvent {
  type: 'model_start';
  run_id: string;
  model_id: string;
  model_index: number;
  total_models: number;
  pair_index?: number;
  start_page?: string;
  target_page?: string;
}

interface ModelCompleteEvent {
  type: 'model_complete';
  run_id: string;
  model_id: string;
  pair_index?: number;
  data: {
    model: string;
    metrics: {
      status: string;
      reason: string;
      total_steps: number;
      total_duration: number;
      hallucination_count: number;
    };
  };
}

interface ModelFinalEvent {
  type: 'model_final';
  run_id: string;
  model_id: string;
  pair_index?: number;
  data: {
    status: string;
    reason: string;
    total_steps: number;
    total_duration: number;
    hallucination_count: number;
  };
}

interface ErrorEvent {
  type: 'error';
  run_id: string;
  error: string;
}

interface StopRequestedEvent {
  type: 'stop_requested';
  run_id: string;
  message: string;
}

interface ModelStoppedEvent {
  type: 'model_stopped';
  run_id: string;
  model_id: string;
  pair_index?: number;
  message: string;
}

interface RunStoppedEvent {
  type: 'run_stopped';
  run_id: string;
  message: string;
  completed_models: string[];
}

interface RunCompletedEvent {
  type: 'run_completed';
  run_id: string;
  summary: {
    run_id: string;
    total_models: number;
    models: string[];
    completed: number;
    failed: number;
  };
  message: string;
}

type WebSocketEvent = RunCreatedEvent | ReadyToStartEvent | RunStartEvent | StepEvent | ModelStartEvent | ModelCompleteEvent | ModelFinalEvent | ErrorEvent | HallucinationEvent | StopRequestedEvent | ModelStoppedEvent | RunStoppedEvent | RunCompletedEvent;

interface LogEntry {
  timestamp: string;
  model: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface ModelData {
  modelId: string;
  pairIndex: number;
  nodes: WikiNode[];
  links: WikiLink[];
  metrics: {
    clicks: number;
    hallucinations: number;
    time: number;
  };
  status: 'running' | 'completed' | 'failed' | null;
}

export interface LiveMonitoringState {
  nodes: WikiNode[];
  links: WikiLink[];
  logs: LogEntry[];
  currentModel: string | null;
  selectedModel: string | null;
  selectedPairIndex: number;
  modelProgress: {
    current: number;
    total: number;
  };
  metrics: {
    clicks: number;
    hallucinations: number;
    time: number;
  };
  isConnected: boolean;
  connectionState: ReadyState;
  allModels: ModelData[];
  pairs: { start_page: string; target_page: string }[];
  startPage: string | null;
  targetPage: string | null;
  selectModel: (modelId: string) => void;
  selectPair: (pairIndex: number) => void;
}

export function useLiveMonitoring(runId: string | undefined, onRunCompleted?: (runId: string) => void) {
  const [state, setState] = useState<Omit<LiveMonitoringState, 'selectModel' | 'selectPair'>>({
    nodes: [],
    links: [],
    logs: [],
    currentModel: null,
    selectedModel: null,
    selectedPairIndex: 0,
    modelProgress: { current: 0, total: 0 },
    metrics: { clicks: 0, hallucinations: 0, time: 0 },
    isConnected: false,
    connectionState: ReadyState.UNINSTANTIATED,
    allModels: [],
    pairs: [],
    startPage: null,
    targetPage: null,
  });

  const socketUrl = runId ? `${WS_BASE_URL}/live/${runId}` : null;

  const { lastJsonMessage, readyState } = useWebSocket(socketUrl, {
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: 3000,
  });

  const addLog = useCallback((message: string, model: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('fr-FR');
    setState((prev) => ({
      ...prev,
      logs: [...prev.logs, { timestamp, model, message, type }].slice(-50), // Keep last 50 logs
    }));
  }, []);

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isConnected: readyState === ReadyState.OPEN,
      connectionState: readyState,
    }));
  }, [readyState]);

  useEffect(() => {
    if (!lastJsonMessage) return;

    const event = lastJsonMessage as WebSocketEvent;

    switch (event.type) {
      case 'run_created': {
        addLog(
          `📡 ${event.message}`,
          'System',
          'info'
        );
        // Store config info early so it's available when model starts
        setState((prev) => ({
          ...prev,
          startPage: event.start_page,
          targetPage: event.target_page,
          modelProgress: {
            current: 0,
            total: event.total_models,
          },
        }));
        break;
      }

      case 'ready_to_start': {
        addLog(
          `${event.message}`,
          'System',
          'success'
        );
        break;
      }

      case 'run_start': {
        addLog(
          `Benchmark started: ${event.total_models} model${event.total_models > 1 ? 's' : ''}, ${event.total_pairs || 1} pair(s)`,
          'System',
          'info'
        );
        
        setState((prev) => ({
          ...prev,
          pairs: event.pairs || [{ start_page: event.start_page, target_page: event.target_page }],
          startPage: event.start_page,
          targetPage: event.target_page,
          modelProgress: {
            current: 0,
            total: event.total_models,
          },
          // Reset state for new run
          currentModel: null,
          selectedModel: null,
          selectedPairIndex: 0,
          allModels: [],
          nodes: [],
          links: [],
          metrics: { clicks: 0, hallucinations: 0, time: 0 },
        }));
        break;
      }

      case 'model_start': {
        const pairIndex = event.pair_index ?? 0;
        setState((prev) => {
          // Use start page from event if available, otherwise from state
          const pageToUse = event.start_page || prev.pairs[pairIndex]?.start_page || prev.startPage;
          const targetPageToUse = event.target_page || prev.pairs[pairIndex]?.target_page || prev.targetPage;
          
          const initialNodes: WikiNode[] = pageToUse ? [{
            id: `node_${pageToUse}`,
            title: pageToUse,
            type: 'start' as const,
            steps: [],
          }] : [];
          
          // Add new model-pair entry to allModels if not exists
          const existingModel = prev.allModels.find(m => m.modelId === event.model_id && m.pairIndex === pairIndex);
          const newModels = existingModel 
            ? prev.allModels 
            : [...prev.allModels, {
                modelId: event.model_id,
                pairIndex: pairIndex,
                nodes: initialNodes,
                links: [],
                metrics: { clicks: 0, hallucinations: 0, time: 0 },
                status: 'running' as const,
              }];
          
          // Only auto-switch the view if it's the first model/pair or if we are already "following"
          // For now, let's auto-switch only if the incoming pair is >= current selected pair
          const shouldSwitchView = pairIndex >= prev.selectedPairIndex;
          
          return {
            ...prev,
            currentModel: event.model_id,
            selectedModel: shouldSwitchView ? event.model_id : prev.selectedModel,
            selectedPairIndex: shouldSwitchView ? pairIndex : prev.selectedPairIndex,
            startPage: shouldSwitchView ? (pageToUse || prev.startPage) : prev.startPage,
            targetPage: shouldSwitchView ? (targetPageToUse || prev.targetPage) : prev.targetPage,
            modelProgress: {
              current: event.model_index + 1,
              total: event.total_models,
            },
            allModels: newModels,
            // Update display nodes/links only if we switched view
            nodes: shouldSwitchView ? initialNodes : prev.nodes,
            links: shouldSwitchView ? [] : prev.links,
            metrics: shouldSwitchView ? { clicks: 0, hallucinations: 0, time: 0 } : prev.metrics,
          };
        });
        addLog(`Starting benchmark with model ${event.model_id} (Pair #${pairIndex + 1})`, event.model_id, 'info');
        break;
      }

      case 'step': {
        const stepNum = event.data.step + 1;
        const duration = Math.round(event.data.llm_duration * 1000); // Convert to ms
        const parsingInfo = event.data.structured_parsing_success 
          ? `✓ Structured` 
          : `⚠ ${event.data.parsing_method || 'regex'}`;
        const conceptInfo = event.data.available_concepts_count 
          ? ` (${event.data.available_concepts_count} concepts)` 
          : '';
        
        let logMessage = `Step ${stepNum}: ${event.data.page_title}${conceptInfo} → ${event.data.next_page_title || 'N/A'} [${duration}ms, ${parsingInfo}]`;
        
        if (event.data.confidence !== undefined) {
          logMessage += ` Confidence: ${(event.data.confidence * 100).toFixed(0)}%`;
        }

        setState((prev) => {
          // CRITICAL: Find which pair this model is currently running
          // We check allModels for a 'running' entry for this modelId
          const runningModelEntry = prev.allModels.find(m => m.modelId === event.model_id && m.status === 'running');
          const pairIndex = runningModelEntry ? runningModelEntry.pairIndex : prev.selectedPairIndex;
          
          const modelExists = prev.allModels.some(m => m.modelId === event.model_id && m.pairIndex === pairIndex);
          let workingModels = [...prev.allModels];
          let workingSelectedModel = prev.selectedModel;
          let workingCurrentModel = prev.currentModel;
          
          if (!modelExists) {
            console.log('🔍 STEP RECEIVED BEFORE MODEL_START - Creating model on-the-fly:', event.model_id);
            const fallbackStartPage = event.data.page_title;
            const newModel: ModelData = {
              modelId: event.model_id,
              pairIndex: pairIndex,
              nodes: [{
                id: `node_${fallbackStartPage}`,
                title: fallbackStartPage,
                type: 'start' as const,
                steps: [],
              }],
              links: [],
              metrics: { clicks: 0, hallucinations: 0, time: 0 },
              status: 'running' as const,
            };
            workingModels = [...prev.allModels, newModel];
            
            if (!workingSelectedModel) workingSelectedModel = event.model_id;
            if (!workingCurrentModel) workingCurrentModel = event.model_id;
          }
          
          // Only auto-switch selected model if it's the one currently running AND we are on the right pair
          if (event.model_id === workingCurrentModel && pairIndex === prev.selectedPairIndex && workingSelectedModel !== event.model_id) {
            workingSelectedModel = event.model_id;
          }

          const updatedModels = workingModels.map(model => {
            if (model.modelId !== event.model_id || model.pairIndex !== pairIndex) return model;
            
            const nodeMap = new Map<string, WikiNode>();
            
            // Rebuild node map from existing nodes with step numbers
            model.nodes.forEach((node) => {
              nodeMap.set(node.id, { ...node });
            });

            // Add or update current page node
            const currentNodeId = `node_${event.data.page_title}`;
            const currentStepNumber = event.data.step + 1;
            
            if (!nodeMap.has(currentNodeId)) {
              nodeMap.set(currentNodeId, {
                id: currentNodeId,
                title: event.data.page_title,
                type: model.nodes.length === 0 ? 'start' : 'visited',
                steps: [currentStepNumber],
              });
            } else {
              // Node exists, add step number if not already present
              const existingNode = nodeMap.get(currentNodeId)!;
              if (!existingNode.steps) existingNode.steps = [];
              if (!existingNode.steps.includes(currentStepNumber)) {
                existingNode.steps.push(currentStepNumber);
              }
            }

            // Add next page node if exists
            const newLinks = [...model.links];
            if (event.data.next_page_title) {
              const nextNodeId = `node_${event.data.next_page_title}`;
              
              // Mark previous current as visited
              nodeMap.forEach((node) => {
                if (node.type === 'current') {
                  node.type = 'visited';
                }
              });

              if (!nodeMap.has(nextNodeId)) {
                nodeMap.set(nextNodeId, {
                  id: nextNodeId,
                  title: event.data.next_page_title,
                  type: 'current',
                  steps: [],
                });
              } else {
                // Node already exists, mark as current
                const existingNode = nodeMap.get(nextNodeId)!;
                existingNode.type = 'current';
              }

              // Add link
              newLinks.push({
                source: currentNodeId,
                target: nextNodeId,
                type: 'normal',
              });
            }

            const isHallucination = event.data.next_concept_id && 
                                    !(event.data.next_concept_id in event.data.mapping);

            return {
              ...model,
              nodes: Array.from(nodeMap.values()),
              links: newLinks,
            metrics: {
              clicks: event.data.step,
              hallucinations: model.metrics.hallucinations + (isHallucination ? 1 : 0),
              time: Math.round(event.data.llm_duration * 1000), // Convert seconds to milliseconds
            },
            };
          });

          // Update display if this is the selected model
          const selectedModelData = updatedModels.find(m => m.modelId === (workingSelectedModel || prev.selectedModel));
          
          return {
            ...prev,
            currentModel: workingCurrentModel || prev.currentModel,
            selectedModel: workingSelectedModel || prev.selectedModel,
            allModels: updatedModels,
            nodes: selectedModelData ? selectedModelData.nodes : prev.nodes,
            links: selectedModelData ? selectedModelData.links : prev.links,
            metrics: selectedModelData ? selectedModelData.metrics : prev.metrics,
          };
        });

        addLog(logMessage, event.model_id, 'info');
        break;
      }

      case 'hallucination':
        addLog(
          `⚠️ Hallucination detected at step ${event.data.step + 1}: Invalid concept "${event.data.invalid_concept_id}" on page "${event.data.page_title}"`,
          event.model_id,
          'error'
        );
        break;

      case 'model_complete':
      case 'model_final': {
        const eventData = event.type === 'model_complete' ? event.data.metrics : event.data;
        const status = eventData.status === 'success' ? 'success' : 'error';
        const pairIndex = event.pair_index ?? 0;

        addLog(
          `Model ${event.model_id} completed: ${eventData.status} (${eventData.total_steps} steps, ${eventData.hallucination_count} hallucinations)`,
          event.model_id,
          status
        );
        
        setState((prev) => {
          const updatedModels = prev.allModels.map(model => {
            if (model.modelId !== event.model_id || model.pairIndex !== pairIndex) return model;
            
            return {
              ...model,
              status: eventData.status === 'success' ? 'completed' as const : 'failed' as const,
              nodes: model.nodes.map((node) =>
                node.type === 'current' 
                  ? { ...node, type: eventData.status === 'success' ? 'target' as const : 'failed' as const } 
                  : node
              ),
            };
          });

          const selectedModelData = updatedModels.find(
            m => m.modelId === prev.selectedModel && m.pairIndex === prev.selectedPairIndex
          );
          
          return {
            ...prev,
            allModels: updatedModels,
            nodes: selectedModelData ? selectedModelData.nodes : prev.nodes,
            links: selectedModelData ? selectedModelData.links : prev.links,
            currentModel: null, // Clear current model on error to hide Stop button
          };
        });
        break;
      }

      case 'error':
        addLog(
          `❌ Error: ${event.error}`,
          'System',
          'error'
        );
        // Mark current node as failed for the current model
        setState((prev) => {
          const updatedModels = prev.allModels.map(model => {
            if (model.modelId !== prev.currentModel) return model;
            
            return {
              ...model,
              status: 'failed' as const,
              nodes: model.nodes.map((node) =>
                node.type === 'current' ? { ...node, type: 'failed' as const } : node
              ),
            };
          });

          const selectedModelData = updatedModels.find(m => m.modelId === prev.selectedModel);
          
          return {
            ...prev,
            allModels: updatedModels,
            nodes: selectedModelData ? selectedModelData.nodes : prev.nodes,
            links: selectedModelData ? selectedModelData.links : prev.links,
            currentModel: null, // Clear current model on error to hide Stop button
          };
        });
        break;

      case 'stop_requested':
        addLog(
          `🛑 ${event.message}`,
          'System',
          'warning'
        );
        break;

      case 'model_stopped':
        addLog(
          `🛑 ${event.message}`,
          event.model_id,
          'warning'
        );
        setState((prev) => {
          const updatedModels = prev.allModels.map(model => {
            // If we don't have pair_index in event, we assume it's the current one
            const pairIndex = event.pair_index ?? prev.selectedPairIndex;
            if (model.modelId !== event.model_id || model.pairIndex !== pairIndex) return model;
            
            return {
              ...model,
              status: 'failed' as const,
              nodes: model.nodes.map((node) =>
                node.type === 'current' ? { ...node, type: 'visited' as const } : node
              ),
            };
          });

          const selectedModelData = updatedModels.find(
            m => m.modelId === prev.selectedModel && m.pairIndex === prev.selectedPairIndex
          );
          
          return {
            ...prev,
            allModels: updatedModels,
            nodes: selectedModelData ? selectedModelData.nodes : prev.nodes,
            links: selectedModelData ? selectedModelData.links : prev.links,
            currentModel: null, // Clear current model
          };
        });
        break;

      case 'run_stopped':
        addLog(
          `🛑 ${event.message}`,
          'System',
          'warning'
        );
        setState((prev) => ({
          ...prev,
          currentModel: null, // Clear current model
        }));
        break;

      case 'run_completed':
        addLog(
          `✅ ${event.message}`,
          'System',
          'success'
        );
        setState((prev) => ({
          ...prev,
          currentModel: null, // Clear current model
        }));
        
        // Trigger redirect callback after a short delay
        if (onRunCompleted) {
          setTimeout(() => {
            onRunCompleted(event.run_id);
          }, 2000); // 2 second delay to allow user to see completion message
        }
        break;
    }
  }, [lastJsonMessage, addLog]);

  // Function to select a model
  const selectModel = useCallback((modelId: string) => {
    setState((prev) => {
      const selectedModelData = prev.allModels.find(
        m => m.modelId === modelId && m.pairIndex === prev.selectedPairIndex
      );
      
      return {
        ...prev,
        selectedModel: modelId,
        nodes: selectedModelData ? selectedModelData.nodes : [],
        links: selectedModelData ? selectedModelData.links : [],
        metrics: selectedModelData ? selectedModelData.metrics : { clicks: 0, hallucinations: 0, time: 0 },
      };
    });
  }, []);

  // Function to select a pair
  const selectPair = useCallback((pairIndex: number) => {
    setState((prev) => {
      const pair = prev.pairs[pairIndex];
      if (!pair) return prev;

      // Find if we have data for the currently selected model in this new pair
      const modelDataForPair = prev.allModels.find(
        m => m.modelId === prev.selectedModel && m.pairIndex === pairIndex
      );

      return {
        ...prev,
        selectedPairIndex: pairIndex,
        startPage: pair.start_page,
        targetPage: pair.target_page,
        nodes: modelDataForPair ? modelDataForPair.nodes : [],
        links: modelDataForPair ? modelDataForPair.links : [],
        metrics: modelDataForPair ? modelDataForPair.metrics : { clicks: 0, hallucinations: 0, time: 0 },
      };
    });
  }, []);

  return { ...state, selectModel, selectPair };
}
