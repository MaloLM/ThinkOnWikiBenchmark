/**
 * Service pour interagir avec le backend FastAPI
 */

import { API_BASE_URL } from '../config';

export interface BenchmarkConfig {
  models: string[];
  sourcePage: string;
  targetPage: string;
  maxClicks: number;
  maxLoops: number;
  temperature: number;
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
  error?: string;
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
        temperature: config.temperature,
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
export async function getModelsFromBackend(): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Le backend retourne la structure de NanoGPT: { data: [...] }
    if (data.data && Array.isArray(data.data)) {
      return data.data.sort((a: any, b: any) => a.id.localeCompare(b.id));
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

/**
 * Valide une URL Wikipedia via le backend
 */
export async function validateWikiUrl(url: string): Promise<{ valid: boolean; title?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/wiki/validate?url=${encodeURIComponent(url)}`, {
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
    console.error('Error validating Wiki URL:', error);
    throw error;
  }
}

/**
 * Récupère le chemin le plus court entre deux pages Wikipedia via WikiRoute
 */
export async function getWikiPath(sourceUrl: string, destUrl: string): Promise<{ found: boolean; path?: string[]; length?: number; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/wiki/path?source_url=${encodeURIComponent(sourceUrl)}&dest_url=${encodeURIComponent(destUrl)}`, {
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
    console.error('Error fetching Wiki path:', error);
    throw error;
  }
}

/**
 * Récupère une page Wikipedia aléatoire via le backend
 */
export async function getRandomWikiPage(): Promise<{ title: string; url: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/wiki/random`, {
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
    console.error('Error fetching random Wiki page:', error);
    throw error;
  }
}
