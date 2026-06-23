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
  // Explicit price per 1M cached (cache-read) input tokens. When omitted, calculateCost
  // falls back to a provider-based multiple of inputPricePer1M (OpenAI 0.5x, Anthropic 0.1x).
  cachedInputPricePer1M?: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI GPT-4.1 models (cached input is explicitly priced by OpenAI)
  'gpt-4.1': {
    inputPricePer1M: 2.00,
    cachedInputPricePer1M: 0.50,
    outputPricePer1M: 8.00,
  },
  'gpt-4.1-mini': {
    inputPricePer1M: 0.40,
    cachedInputPricePer1M: 0.10,
    outputPricePer1M: 1.60,
  },
  'gpt-4.1-nano': {
    inputPricePer1M: 0.10,
    cachedInputPricePer1M: 0.025,
    outputPricePer1M: 0.40,
  },

  // OpenAI GPT-4o models
  'gpt-4o': {
    inputPricePer1M: 2.50,
    cachedInputPricePer1M: 1.25,
    outputPricePer1M: 10.00,
  },
  'gpt-4o-mini': {
    inputPricePer1M: 0.150,
    cachedInputPricePer1M: 0.075,
    outputPricePer1M: 0.600,
  },
  'gpt-4o-2024-11-20': {
    inputPricePer1M: 2.50,
    cachedInputPricePer1M: 1.25,
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
 * @param cacheCreationInputTokens - Cache creation tokens (Anthropic: 1.25x input rate)
 * @param cacheReadInputTokens - Cache read tokens (Anthropic: 0.1x input rate; OpenAI: 0.5x input rate)
 * @param provider - Optional provider hint (e.g. 'openai'). When omitted, the provider is
 *   inferred from the matched pricing key.
 * @returns Total cost in USD
 */
export function calculateCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationInputTokens?: number,
  cacheReadInputTokens?: number,
  provider?: string
): number {
  const pricing = MODEL_PRICING[modelName] || MODEL_PRICING['_default'];

  // Cache-read discount differs by provider's prompt-caching model:
  // Anthropic cache reads are ~90% off (0.1x input rate); OpenAI's automatic
  // prompt caching is ~50% off (0.5x input rate). Prefer the explicit provider hint;
  // otherwise infer from the matched pricing key (OpenAI models resolve to a "gpt*" key).
  const isOpenAI = provider
    ? provider.toLowerCase() === 'openai'
    : modelName.startsWith('gpt');

  const cacheReadTokens = cacheReadInputTokens ?? 0;

  // OpenAI's prompt_tokens INCLUDES cached tokens, so the cached portion is part of the
  // reported inputTokens and must be removed before charging the full input rate (otherwise
  // cached tokens are billed twice — once at full rate, once at the discounted rate).
  // Anthropic reports input_tokens EXCLUDING cache reads, so inputTokens is already the
  // full-rate portion and must not be reduced.
  const fullRateInputTokens = isOpenAI
    ? Math.max(0, inputTokens - cacheReadTokens)
    : inputTokens;

  const inputCost = (fullRateInputTokens / 1_000_000) * pricing.inputPricePer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePer1M;

  // Resolve the cache-read rate: prefer an explicit per-model cached price, else fall back
  // to the provider-appropriate multiple of the input rate.
  const cacheReadMultiplier = isOpenAI ? 0.5 : 0.1;
  const cachedInputRate =
    pricing.cachedInputPricePer1M ?? pricing.inputPricePer1M * cacheReadMultiplier;

  let cacheCreationCost = 0;
  let cacheReadCost = 0;

  if (cacheCreationInputTokens) {
    cacheCreationCost = (cacheCreationInputTokens / 1_000_000) * pricing.inputPricePer1M * 1.25;
  }

  if (cacheReadTokens) {
    cacheReadCost = (cacheReadTokens / 1_000_000) * cachedInputRate;
  }

  return inputCost + outputCost + cacheCreationCost + cacheReadCost;
}

/**
 * Match model name to pricing key (handles versions, aliases)
 *
 * @param modelNameOrId - Model name or ID (may include version suffix or provider prefix)
 * @returns Matched pricing key or '_default'
 */
export function matchModelToPricing(modelNameOrId: string): string {
  if (MODEL_PRICING[modelNameOrId]) return modelNameOrId;

  // Prefer the longest matching known key so e.g. "gpt-4.1-mini-2025-04-14" resolves to
  // "gpt-4.1-mini" rather than the shorter (and pricier) "gpt-4.1".
  const keys = Object.keys(MODEL_PRICING).filter(k => k !== '_default');
  const prefixMatches = keys.filter(key => modelNameOrId.startsWith(key));
  if (prefixMatches.length > 0) {
    return prefixMatches.reduce((a, b) => (b.length > a.length ? b : a));
  }

  // Alias handling for ids that embed a known family but don't share a clean prefix
  // (e.g. provider-prefixed "openai/gpt-4o"). Most specific first.
  if (modelNameOrId.includes('gpt-4.1-nano')) return 'gpt-4.1-nano';
  if (modelNameOrId.includes('gpt-4.1-mini')) return 'gpt-4.1-mini';
  if (modelNameOrId.includes('gpt-4.1')) return 'gpt-4.1';
  if (modelNameOrId.includes('gpt-4o-mini')) return 'gpt-4o-mini';
  if (modelNameOrId.includes('gpt-4o')) return 'gpt-4o';
  if (modelNameOrId.includes('gpt-4-turbo')) return 'gpt-4-turbo';
  if (modelNameOrId.includes('gpt-3.5-turbo')) return 'gpt-3.5-turbo';

  if (modelNameOrId.includes('claude-3-5-sonnet')) return 'claude-3-5-sonnet-20241022';
  if (modelNameOrId.includes('claude-3-5-haiku')) return 'claude-3-5-haiku-20241022';
  if (modelNameOrId.includes('claude-3-opus')) return 'claude-3-opus-20240229';
  if (modelNameOrId.includes('claude-3-sonnet')) return 'claude-3-sonnet-20240229';
  if (modelNameOrId.includes('claude-3-haiku')) return 'claude-3-haiku-20240307';

  // Not-yet-priced families (gpt-5, o-series, chatgpt, fine-tuned ft:*) fall back to the
  // default rate. We deliberately do NOT alias them to gpt-4o pricing — that silently
  // misstates cost (e.g. gpt-4.1 input is $2.00/1M, not gpt-4o's $2.50/1M). The provider
  // used for the cache-read discount is determined separately by inferProviderFromModel,
  // so falling to '_default' here does not break OpenAI cache pricing.
  console.warn(`[Pricing] No explicit pricing for model: ${modelNameOrId}, using default`);
  return '_default';
}

/**
 * Infer the LLM provider from a raw model name/id, for selecting the correct cache-read
 * discount in calculateCost. Returns 'openai', 'anthropic', or undefined when unknown.
 *
 * This is intentionally separate from matchModelToPricing: a model may have no explicit
 * pricing entry (resolving to '_default') yet still need the correct provider semantics
 * for cache accounting.
 */
export function inferProviderFromModel(modelNameOrId: string): string | undefined {
  const id = modelNameOrId.toLowerCase();
  if (id.includes('claude')) return 'anthropic';
  if (
    id.startsWith('gpt') ||
    id.startsWith('ft:gpt') ||
    id.startsWith('chatgpt') ||
    id.includes('gpt-') ||
    /(^|[^a-z])o[0-9]([^a-z]|$)/.test(id)
  ) {
    return 'openai';
  }
  return undefined;
}
