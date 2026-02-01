/**
 * Cleans a model name by removing any content within parentheses.
 * Example: "gpt-4o (google)" -> "gpt-4o"
 */
export const cleanModelName = (name: string): string => {
  return name.replace(/\s*\([^)]*\)/g, '').trim();
};
