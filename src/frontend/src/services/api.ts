/**
 * Service pour interagir avec le backend FastAPI
 */

import { API_BASE_URL } from '../config';

export interface BenchmarkConfig {
  apiKey: string;
  models: string[];
  sourcePage: string;
  targetPage: string;
  maxClicks: number;
  maxLoops: number;
}

export interface StartBenchmarkResponse {
  run_id: string;
  message?: string;
}

export interface Archive {
  run_id: string;
  config: {
    models: string[];
    start_page: string;
    target_page: string;
    max_steps: number;
    max_loops: number;
  };
  timestamp: string;
}

export interface ModelMetrics {
  status: string;
  reason: string;
  model: string;
  total_steps: number;
  total_duration: number;
  avg_llm_duration: number;
  hallucination_rate: number;
  hallucination_count: number;
  path: string[];
}

export interface ModelData {
  metrics: ModelMetrics;
  steps: any[];
}

export interface ArchiveDetails {
  config: {
    models: string[];
    start_page: string;
    target_page: string;
    max_steps: number;
    max_loops: number;
  };
  summary?: {
    run_id: string;
    total_models: number;
    models: string[];
    completed: number;
    failed: number;
  };
  models: {
    [modelId: string]: ModelData;
  };
}

/**
 * Démarre un nouveau benchmark
 */
export async function startBenchmark(config: BenchmarkConfig): Promise<StartBenchmarkResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        models: config.models,
        start_page: config.sourcePage,
        target_page: config.targetPage,
        max_steps: config.maxClicks,
        max_loops: config.maxLoops,
        api_key: config.apiKey,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error starting benchmark:', error);
    throw error;
  }
}

/**
 * Récupère la liste des modèles disponibles depuis le backend
 */
export async function getModelsFromBackend(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Le backend retourne la structure de NanoGPT: { data: [...] }
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((model: any) => model.id);
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching models from backend:', error);
    throw error;
  }
}

/**
 * Récupère la liste des archives
 */
export async function getArchives(): Promise<Archive[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/archives`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching archives:', error);
    throw error;
  }
}

/**
 * Récupère les détails d'une archive spécifique
 */
export async function getArchiveDetails(runId: string): Promise<ArchiveDetails> {
  try {
    const response = await fetch(`${API_BASE_URL}/archives/${runId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching archive details:', error);
    throw error;
  }
}

/**
 * Arrête un benchmark en cours d'exécution
 */
export async function stopBenchmark(runId: string): Promise<{ message: string; run_id: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/runs/${runId}/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error stopping benchmark:', error);
    throw error;
  }
}
