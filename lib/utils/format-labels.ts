/**
 * Formatting utilities for analytics labels and text
 */

/**
 * Format model names by replacing underscores with slashes for better readability
 * Examples:
 * - "mistralai_Mistral-7B-Instruct-v0.3" → "mistralai/Mistral-7B-Instruct-v0.3"
 * - "openai_gpt-4" → "openai/gpt-4"
 * - "my_custom_model" → "my/custom/model"
 */
export function formatModelName(modelName: string | null | undefined): string {
  if (!modelName) return '';

  // Replace underscores with forward slashes for readability
  // This matches the common format used in HuggingFace and model registries
  return modelName.replace(/_/g, '/');
}

/**
 * Format provider names by capitalizing first letter and removing underscores
 * Examples:
 * - "openai" → "OpenAI"
 * - "anthropic" → "Anthropic"
 * - "hugging_face" → "Hugging Face"
 */
export function formatProviderName(provider: string | null | undefined): string {
  if (!provider) return '';

  // Replace underscores with spaces
  const withSpaces = provider.replace(/_/g, ' ');

  // Capitalize each word
  return withSpaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format training method names for display
 * Examples:
 * - "sft" → "SFT"
 * - "supervised_fine_tuning" → "Supervised Fine Tuning"
 * - "dpo" → "DPO"
 */
export function formatTrainingMethod(method: string | null | undefined): string {
  if (!method) return '';

  // Known acronyms that should be uppercase
  const acronyms = ['sft', 'dpo', 'rlhf'];

  if (acronyms.includes(method.toLowerCase())) {
    return method.toUpperCase();
  }

  // Replace underscores with spaces and capitalize
  return method
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format session/experiment names by removing prefixes and formatting
 * Examples:
 * - "session_abc123" → "abc123"
 * - "experiment_my_test" → "My Test"
 */
export function formatSessionName(sessionName: string | null | undefined): string {
  if (!sessionName) return '';

  // Remove common prefixes
  let formatted = sessionName
    .replace(/^(session|experiment)_/i, '')
    .replace(/_/g, ' ');

  // Capitalize first letter of each word
  return formatted
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Truncate long text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncating
 */
export function truncate(text: string | null | undefined, maxLength: number = 50): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format label for charts - replaces underscores and capitalizes
 * Examples:
 * - "avg_response_time" → "Avg Response Time"
 * - "total_cost" → "Total Cost"
 */
export function formatChartLabel(label: string | null | undefined): string {
  if (!label) return '';

  return label
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
