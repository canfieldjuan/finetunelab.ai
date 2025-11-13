// Pricing utility for evaluation metrics
// Provides model pricing lookup and cost calculations

import { ALL_TEMPLATES } from '../../models/model-templates';

// ============================================================================
// TYPES
// ============================================================================

export interface ModelPricing {
  inputPricePerToken: number;
  outputPricePerToken: number;
  found: boolean;
}

// ============================================================================
// PRICING CACHE
// ============================================================================

const pricingCache = new Map<string, ModelPricing>();

// ============================================================================
// PRICING LOOKUP
// ============================================================================

/**
 * Get pricing information for a specific model
 * @param modelId - The model identifier (e.g., 'gpt-4o-mini', 'claude-3-5-sonnet-20241022')
 * @returns Pricing information with input/output token prices
 */
export function getModelPricing(modelId: string): ModelPricing {
  console.log('[Pricing] Looking up pricing for model:', modelId);
  
  // Check cache first for performance
  if (pricingCache.has(modelId)) {
    console.log('[Pricing] Cache hit for:', modelId);
    return pricingCache.get(modelId)!;
  }
  
  // Find model in templates
  // Try exact match on model_id or id field
  const template = ALL_TEMPLATES.find(
    t => t.model_id === modelId || t.id === modelId
  );
  
  if (!template) {
    console.warn('[Pricing] Model not found in templates:', modelId);
    const notFound: ModelPricing = {
      inputPricePerToken: 0,
      outputPricePerToken: 0,
      found: false
    };
    // Cache the "not found" result to avoid repeated lookups
    pricingCache.set(modelId, notFound);
    return notFound;
  }
  
  // Extract pricing from template
  const pricing: ModelPricing = {
    inputPricePerToken: template.price_per_input_token ?? 0,
    outputPricePerToken: template.price_per_output_token ?? 0,
    found: true
  };
  
  // Cache the result
  pricingCache.set(modelId, pricing);
  console.log('[Pricing] Cached pricing for:', modelId, {
    input: pricing.inputPricePerToken,
    output: pricing.outputPricePerToken
  });
  
  return pricing;
}

// ============================================================================
// COST CALCULATION
// ============================================================================

/**
 * Calculate total cost for a single message/completion
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param modelId - The model identifier
 * @returns Total cost in dollars
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  modelId: string
): number {
  const pricing = getModelPricing(modelId);
  
  if (!pricing.found) {
    console.warn('[Pricing] Using zero cost for unknown model:', modelId);
    return 0;
  }
  
  // Calculate cost: tokens * price_per_token
  const inputCost = inputTokens * pricing.inputPricePerToken;
  const outputCost = outputTokens * pricing.outputPricePerToken;
  const totalCost = inputCost + outputCost;
  
  console.log('[Pricing] Calculated cost:', {
    modelId,
    inputTokens,
    outputTokens,
    inputCost: inputCost.toFixed(6),
    outputCost: outputCost.toFixed(6),
    totalCost: totalCost.toFixed(6)
  });
  
  return totalCost;
}

// ============================================================================
// BATCH COST CALCULATION
// ============================================================================

export interface MessageCost {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Calculate costs for multiple messages grouped by model
 * @param evaluations - Array of message cost data
 * @returns Map of model_id to total cost
 */
export function calculateBatchCosts(
  evaluations: MessageCost[]
): Map<string, number> {
  console.log('[Pricing] Starting batch calculation for', evaluations.length, 'evaluations');
  
  const costsByModel = new Map<string, number>();
  
  evaluations.forEach(({ modelId, inputTokens, outputTokens }) => {
    const cost = calculateCost(inputTokens, outputTokens, modelId);
    const currentCost = costsByModel.get(modelId) || 0;
    costsByModel.set(modelId, currentCost + cost);
  });
  
  const totalCost = Array.from(costsByModel.values())
    .reduce((sum, cost) => sum + cost, 0);
  
  console.log('[Pricing] Batch calculation complete:', {
    modelsProcessed: costsByModel.size,
    totalEvaluations: evaluations.length,
    totalCost: totalCost.toFixed(6)
  });
  
  return costsByModel;
}

// ============================================================================
// COST COMPARISON
// ============================================================================

export interface CostComparison {
  currentModel: string;
  alternativeModel: string;
  currentCost: number;
  alternativeCost: number;
  savings: number;
  savingsPercent: number;
}

/**
 * Compare costs between two models for the same token usage
 * @param currentModelId - Current model being used
 * @param alternativeModelId - Alternative model to compare
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost comparison data
 */
export function compareCosts(
  currentModelId: string,
  alternativeModelId: string,
  inputTokens: number,
  outputTokens: number
): CostComparison {
  const currentCost = calculateCost(inputTokens, outputTokens, currentModelId);
  const alternativeCost = calculateCost(inputTokens, outputTokens, alternativeModelId);
  
  const savings = currentCost - alternativeCost;
  const savingsPercent = currentCost > 0 
    ? (savings / currentCost) * 100 
    : 0;
  
  console.log('[Pricing] Cost comparison:', {
    current: `${currentModelId}: $${currentCost.toFixed(6)}`,
    alternative: `${alternativeModelId}: $${alternativeCost.toFixed(6)}`,
    savings: `$${savings.toFixed(6)} (${savingsPercent.toFixed(1)}%)`
  });
  
  return {
    currentModel: currentModelId,
    alternativeModel: alternativeModelId,
    currentCost,
    alternativeCost,
    savings,
    savingsPercent
  };
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Clear the pricing cache (useful for testing or when templates are updated)
 */
export function clearPricingCache(): void {
  const cacheSize = pricingCache.size;
  pricingCache.clear();
  console.log('[Pricing] Cache cleared:', cacheSize, 'entries removed');
}

/**
 * Get the current cache size
 */
export function getCacheSize(): number {
  return pricingCache.size;
}

/**
 * Get all cached model IDs
 */
export function getCachedModels(): string[] {
  return Array.from(pricingCache.keys());
}
