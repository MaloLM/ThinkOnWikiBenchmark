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
  start_page: string;
  target_page: string;
}

interface ModelStartEvent {
  type: 'model_start';
  run_id: string;
  model_id: string;
  model_index: number;
  total_models: number;
  start_page?: string;
}

interface ModelCompleteEvent {
  type: 'model_complete';
  run_id: string;
  model_id: string;
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
  startPage: string | null;
  targetPage: string | null;
}

export function useLiveMonitoring(runId: string | undefined, onRunCompleted?: (runId: string) => void) {
  const [state, setState] = useState<LiveMonitoringState>({
    nodes: [],
    links: [],
    logs: [],
    currentModel: null,
    selectedModel: null,
    modelProgress: { current: 0, total: 0 },
    metrics: { clicks: 0, hallucinations: 0, time: 0 },
    isConnected: false,
    connectionState: ReadyState.UNINSTANTIATED,
    allModels: [],
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
          `🚀 ${event.message}`,
          'System',
          'success'
        );
        break;
      }

      case 'run_start': {
        addLog(
          `Benchmark started: ${event.start_page} → ${event.target_page} (${event.total_models} model${event.total_models > 1 ? 's' : ''})`,
          'System',
          'info'
        );
        
        setState((prev) => ({
          ...prev,
          startPage: event.start_page,
          targetPage: event.target_page,
          modelProgress: {
            current: 0,
            total: event.total_models,
          },
          // Reset state for new run
          currentModel: null,
          selectedModel: null,
          allModels: [],
          nodes: [],
          links: [],
          metrics: { clicks: 0, hallucinations: 0, time: 0 },
        }));
        break;
      }

      case 'model_start':
        setState((prev) => {
          // Create initial node with start page from state
          const pageToUse = prev.startPage;
          console.log('🔍 MODEL_START DEBUG:', {
            model_id: event.model_id,
            model_index: event.model_index,
            startPage: pageToUse,
            prevSelectedModel: prev.selectedModel,
            prevCurrentModel: prev.currentModel,
            prevAllModelsCount: prev.allModels.length,
            prevNodesCount: prev.nodes.length
          });
          
          const initialNodes: WikiNode[] = pageToUse ? [{
            id: `node_${pageToUse}`,
            title: pageToUse,
            type: 'start' as const,
            steps: [],
          }] : [];
          
          // Add new model to allModels if not exists
          const existingModel = prev.allModels.find(m => m.modelId === event.model_id);
          const newModels = existingModel 
            ? prev.allModels 
            : [...prev.allModels, {
                modelId: event.model_id,
                nodes: initialNodes,
                links: [],
                metrics: { clicks: 0, hallucinations: 0, time: 0 },
                status: 'running' as const,
              }];
          
          // Always auto-switch to the newly started model for live monitoring
          // This ensures the graph automatically displays the current running model
          const shouldAutoSelect = true;
          const newSelectedModel = event.model_id;
          
          console.log('🔍 MODEL_START RESULT:', {
            shouldAutoSelect,
            newSelectedModel,
            initialNodesCount: initialNodes.length,
            newModelsCount: newModels.length
          });
          
          return {
            ...prev,
            currentModel: event.model_id,
            selectedModel: newSelectedModel,
            modelProgress: {
              current: event.model_index + 1,
              total: event.total_models,
            },
            allModels: newModels,
            // Update display if this model is now selected
            nodes: shouldAutoSelect ? initialNodes : prev.nodes,
            links: shouldAutoSelect ? [] : prev.links,
            metrics: shouldAutoSelect 
              ? { clicks: 0, hallucinations: 0, time: 0 } 
              : prev.metrics,
          };
        });
        addLog(`Starting benchmark with model ${event.model_id}`, event.model_id, 'info');
        break;

      case 'step': {
        // Build enriched log message
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
          // Check if model exists - if not, create it (handles case where step arrives before model_start)
          let modelExists = prev.allModels.some(m => m.modelId === event.model_id);
          let workingModels = [...prev.allModels];
          let workingSelectedModel = prev.selectedModel;
          let workingCurrentModel = prev.currentModel;
          
          if (!modelExists) {
            console.log('🔍 STEP RECEIVED BEFORE MODEL_START - Creating model on-the-fly:', event.model_id);
            // Create the model entry - use the page_title from step as fallback start page
            const fallbackStartPage = event.data.page_title;
            const newModel: ModelData = {
              modelId: event.model_id,
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
            
            // Auto-select if no model is selected
            if (!workingSelectedModel) {
              workingSelectedModel = event.model_id;
            }
            if (!workingCurrentModel) {
              workingCurrentModel = event.model_id;
            }
          }
          
          // Safety check: Auto-switch to current model if a step arrives for it
          // This handles edge cases where the user manually switched away but the model is still running
          if (event.model_id === workingCurrentModel && workingSelectedModel !== event.model_id) {
            console.log('🔄 Auto-switching back to currently running model:', event.model_id);
            workingSelectedModel = event.model_id;
          }

          // Update the model's data in allModels
          const updatedModels = workingModels.map(model => {
            if (model.modelId !== event.model_id) return model;
            
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
                clicks: event.data.step + 1,
                hallucinations: model.metrics.hallucinations + (isHallucination ? 1 : 0),
                time: Math.round(event.data.llm_duration),
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
        addLog(
          `Model ${event.model_id} completed: ${eventData.status} (${eventData.total_steps} steps, ${eventData.hallucination_count} hallucinations)`,
          event.model_id,
          status
        );
        
        // Mark final node and update status
        setState((prev) => {
          const updatedModels = prev.allModels.map(model => {
            if (model.modelId !== event.model_id) return model;
            
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

          const selectedModelData = updatedModels.find(m => m.modelId === prev.selectedModel);
          
          return {
            ...prev,
            allModels: updatedModels,
            nodes: selectedModelData ? selectedModelData.nodes : prev.nodes,
            links: selectedModelData ? selectedModelData.links : prev.links,
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
        // Mark current model as stopped
        setState((prev) => {
          const updatedModels = prev.allModels.map(model => {
            if (model.modelId !== event.model_id) return model;
            
            return {
              ...model,
              status: 'failed' as const, // Use 'failed' status for stopped models
              nodes: model.nodes.map((node) =>
                node.type === 'current' ? { ...node, type: 'visited' as const } : node
              ),
            };
          });

          const selectedModelData = updatedModels.find(m => m.modelId === prev.selectedModel);
          
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
      const selectedModelData = prev.allModels.find(m => m.modelId === modelId);
      if (!selectedModelData) return prev;
      
      return {
        ...prev,
        selectedModel: modelId,
        nodes: selectedModelData.nodes,
        links: selectedModelData.links,
        metrics: selectedModelData.metrics,
      };
    });
  }, []);

  return { ...state, selectModel };
}
