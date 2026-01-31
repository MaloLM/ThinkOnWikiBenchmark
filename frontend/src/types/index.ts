import * as d3 from 'd3';

export interface WikiNode extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  type: 'start' | 'target' | 'visited' | 'current' | 'failed' | 'not_found';
  model?: string;
  steps?: number[]; // Numéros d'étapes où ce nœud a été visité (si le LLM revient sur un nœud, il y aura plusieurs étapes)
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface WikiLink {
  source: string | WikiNode;
  target: string | WikiNode;
  type: 'normal' | 'backtrack' | 'loop';
}

export interface LLMMessage {
  role: string;
  content: string;
}

export interface BenchmarkStep {
  timestamp: string;
  nodeId: string;
  title: string;
  action: string;
  prompt?: string;
  sent_prompt?: LLMMessage[];
  response?: string;
  intuition?: string;
  metrics: {
    clicks: number;
    hallucinations: number;
    time: number;
  };
}

export type ApiKeyStatus = 'idle' | 'testing' | 'valid' | 'invalid';
