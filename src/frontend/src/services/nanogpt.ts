/**
 * Service pour interagir avec l'API NanoGPT
 */

export interface NanoGPTModel {
  id: string;
  name?: string;
  created?: number;
  owned_by?: string;
}

export interface ModelsResponse {
  data: NanoGPTModel[];
  object: string;
}

const API_BASE_URL = "https://nano-gpt.com/api/v1";

/**
 * Teste si une clé API est valide en appelant l'endpoint /models
 */
export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    return response.ok;
  } catch (error) {
    console.error("Error testing API key:", error);
    return false;
  }
}

/**
 * Récupère la liste des modèles disponibles
 */
export async function getAvailableModels(
  apiKey: string,
): Promise<NanoGPTModel[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ModelsResponse = await response.json();

    // Trier par ordre alphabétique
    return data.data.sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    console.error("Error fetching models:", error);
    throw error;
  }
}
