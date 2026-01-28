/**
 * Utility functions for managing favorite models in local storage
 */

const FAVORITES_STORAGE_KEY = "favorite_models";

/**
 * Get all favorite model IDs from local storage
 */
export const getFavorites = (): string[] => {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to parse favorites from local storage", error);
  }
  return [];
};

/**
 * Add a model ID to favorites
 */
export const addFavorite = (modelId: string): void => {
  const favorites = getFavorites();
  if (!favorites.includes(modelId)) {
    favorites.push(modelId);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }
};

/**
 * Remove a model ID from favorites
 */
export const removeFavorite = (modelId: string): void => {
  const favorites = getFavorites();
  const filtered = favorites.filter((id) => id !== modelId);
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(filtered));
};

/**
 * Toggle a model ID in favorites (add if not present, remove if present)
 */
export const toggleFavorite = (modelId: string): boolean => {
  const favorites = getFavorites();
  const isFavorite = favorites.includes(modelId);
  
  if (isFavorite) {
    removeFavorite(modelId);
  } else {
    addFavorite(modelId);
  }
  
  return !isFavorite; // Return new favorite status
};

/**
 * Check if a model ID is in favorites
 */
export const isFavorite = (modelId: string): boolean => {
  const favorites = getFavorites();
  return favorites.includes(modelId);
};
