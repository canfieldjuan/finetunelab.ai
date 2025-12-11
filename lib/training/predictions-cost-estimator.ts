/**
 * Predictions Cost Estimator
 *
 * Estimates the cost of generating predictions during training.
 * Helps users make informed decisions about sampling configuration.
 */

import type { PredictionsConfig } from './types/predictions-types';

export interface CostEstimate {
  total_predictions: number;
  estimated_tokens: number;
  estimated_cost_usd: number;
  cost_per_epoch: number;
}

/**
 * Estimate cost of predictions for a training job
 */
export function estimatePredictionsCost(
  config: PredictionsConfig,
  total_epochs: number,
  model_name?: string
): CostEstimate {
  if (!config.enabled) {
    return {
      total_predictions: 0,
      estimated_tokens: 0,
      estimated_cost_usd: 0,
      cost_per_epoch: 0,
    };
  }

  const predictions_per_run =
    config.sample_frequency === 'epoch'
      ? config.sample_count * total_epochs
      : config.sample_count;

  const avg_tokens_per_prediction = parseInt(
    process.env.PREDICTIONS_AVG_TOKENS || '300',
    10
  );

  const total_tokens = predictions_per_run * avg_tokens_per_prediction;

  const cost_per_1k_tokens = getCostPer1kTokens(model_name);
  const estimated_cost = (total_tokens / 1000) * cost_per_1k_tokens;

  const cost_per_epoch =
    config.sample_frequency === 'epoch'
      ? (config.sample_count * avg_tokens_per_prediction / 1000) *
        cost_per_1k_tokens
      : 0;

  return {
    total_predictions: predictions_per_run,
    estimated_tokens: total_tokens,
    estimated_cost_usd: Math.round(estimated_cost * 100) / 100,
    cost_per_epoch: Math.round(cost_per_epoch * 100) / 100,
  };
}

/**
 * Get inference cost per 1k tokens for model
 */
function getCostPer1kTokens(model_name?: string): number {
  const default_cost = parseFloat(
    process.env.PREDICTIONS_DEFAULT_COST_PER_1K || '0.01'
  );

  if (!model_name) {
    return default_cost;
  }

  const model_lower = model_name.toLowerCase();

  if (model_lower.includes('7b')) {
    return parseFloat(process.env.PREDICTIONS_COST_7B || '0.005');
  }

  if (model_lower.includes('13b')) {
    return parseFloat(process.env.PREDICTIONS_COST_13B || '0.01');
  }

  if (model_lower.includes('70b')) {
    return parseFloat(process.env.PREDICTIONS_COST_70B || '0.05');
  }

  return default_cost;
}

/**
 * Format cost for display
 */
export function formatCost(cost_usd: number): string {
  if (cost_usd < 0.01) {
    return '<$0.01';
  }
  return `$${cost_usd.toFixed(2)}`;
}
