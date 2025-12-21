/**
 * LLM Pricing Configuration
 *
 * Hardcoded pricing for cost_usd calculation in traces.
 * Prices are in USD per 1M tokens.
 *
 * Date: 2025-12-20
 * Pricing as of December 2025 (update periodically)
 *
 * Note: This is a temporary hardcoded solution. Future enhancement
 * should move pricing to database configuration table.
 */

export interface ModelPricing {
  inputPricePer1M: number;
  outputPricePer1M: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI GPT-4o models
  'gpt-4o': {
    inputPricePer1M: 2.50,
    outputPricePer1M: 10.00,
  },
  'gpt-4o-mini': {
    inputPricePer1M: 0.150,
    outputPricePer1M: 0.600,
  },
  'gpt-4o-2024-11-20': {
    inputPricePer1M: 2.50,
    outputPricePer1M: 10.00,
  },

  // OpenAI GPT-4 Turbo
  'gpt-4-turbo': {
    inputPricePer1M: 10.00,
    outputPricePer1M: 30.00,
  },
  'gpt-4-turbo-2024-04-09': {
    inputPricePer1M: 10.00,
    outputPricePer1M: 30.00,
  },

  // OpenAI GPT-3.5 Turbo
  'gpt-3.5-turbo': {
    inputPricePer1M: 0.50,
    outputPricePer1M: 1.50,
  },
  'gpt-3.5-turbo-0125': {
    inputPricePer1M: 0.50,
    outputPricePer1M: 1.50,
  },

  // Anthropic Claude 3.5
  'claude-3-5-sonnet-20241022': {
    inputPricePer1M: 3.00,
    outputPricePer1M: 15.00,
  },
  'claude-3-5-haiku-20241022': {
    inputPricePer1M: 0.80,
    outputPricePer1M: 4.00,
  },

  // Anthropic Claude 3
  'claude-3-opus-20240229': {
    inputPricePer1M: 15.00,
    outputPricePer1M: 75.00,
  },
  'claude-3-sonnet-20240229': {
    inputPricePer1M: 3.00,
    outputPricePer1M: 15.00,
  },
  'claude-3-haiku-20240307': {
    inputPricePer1M: 0.25,
    outputPricePer1M: 1.25,
  },

  // Default fallback for unknown models
  '_default': {
    inputPricePer1M: 1.00,
    outputPricePer1M: 3.00,
  },
};

/**
 * Calculate cost in USD for token usage
 *
 * @param modelName - Model identifier (e.g., "gpt-4o-mini", "claude-3-5-sonnet-20241022")
 * @param inputTokens - Number of input tokens consumed
 * @param outputTokens - Number of output tokens generated
 * @returns Total cost in USD
 */
export function calculateCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[modelName] || MODEL_PRICING['_default'];

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePer1M;

  return inputCost + outputCost;
}

/**
 * Match model name to pricing key (handles versions, aliases)
 *
 * @param modelNameOrId - Model name or ID (may include version suffix or provider prefix)
 * @returns Matched pricing key or '_default'
 */
export function matchModelToPricing(modelNameOrId: string): string {
  if (MODEL_PRICING[modelNameOrId]) return modelNameOrId;

  const keys = Object.keys(MODEL_PRICING);
  const match = keys.find(key => modelNameOrId.startsWith(key));
  if (match) return match;

  if (modelNameOrId.includes('gpt-4o-mini')) return 'gpt-4o-mini';
  if (modelNameOrId.includes('gpt-4o')) return 'gpt-4o';
  if (modelNameOrId.includes('gpt-4-turbo')) return 'gpt-4-turbo';
  if (modelNameOrId.includes('gpt-3.5-turbo')) return 'gpt-3.5-turbo';

  if (modelNameOrId.includes('claude-3-5-sonnet')) return 'claude-3-5-sonnet-20241022';
  if (modelNameOrId.includes('claude-3-5-haiku')) return 'claude-3-5-haiku-20241022';
  if (modelNameOrId.includes('claude-3-opus')) return 'claude-3-opus-20240229';
  if (modelNameOrId.includes('claude-3-sonnet')) return 'claude-3-sonnet-20240229';
  if (modelNameOrId.includes('claude-3-haiku')) return 'claude-3-haiku-20240307';

  console.warn(`[Pricing] No pricing found for model: ${modelNameOrId}, using default`);
  return '_default';
}
