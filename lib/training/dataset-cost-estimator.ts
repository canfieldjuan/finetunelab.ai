/**
 * Dataset Cost Estimator
 * Estimates training costs based on dataset size and provider pricing
 * Date: 2025-12-07
 */

export interface CostEstimate {
  provider: string;
  totalTokens: number;
  trainingTokens: number;
  estimatedCost: number;
  currency: string;
  breakdown: {
    epochs: number;
    costPerEpoch: number;
    estimatedHours: number;
  };
  warnings: string[];
}

export interface CostEstimateOptions {
  model?: string;
  gpuType?: string;
  tokensPerSecond?: number;
  epochs?: number;
}

// Approximate pricing per 1M tokens (as of late 2024)
const OPENAI_PRICING: Record<string, { training: number; inference: number }> = {
  'gpt-3.5-turbo': { training: 8.00, inference: 0.002 },
  'gpt-4': { training: 25.00, inference: 0.03 },
  'gpt-4-turbo': { training: 25.00, inference: 0.01 },
};

// RunPod GPU pricing per hour
const RUNPOD_GPU_PRICING: Record<string, number> = {
  'RTX 3090': 0.44,
  'RTX 4090': 0.74,
  'A40': 0.79,
  'A100-40GB': 1.89,
  'A100-80GB': 2.49,
  'H100': 4.49,
};

// Approximate tokens per second for different GPUs (SFT training)
const GPU_THROUGHPUT: Record<string, number> = {
  'RTX 3090': 80,
  'RTX 4090': 150,
  'A40': 120,
  'A100-40GB': 250,
  'A100-80GB': 350,
  'H100': 500,
};

// Local training cost estimate (electricity + depreciation)
const LOCAL_TRAINING = {
  gpuHourCost: 0.15, // Conservative estimate
  defaultThroughput: 100, // tokens/second
};

/**
 * Estimate training cost for OpenAI fine-tuning
 */
export function estimateOpenAICost(
  totalTokens: number,
  epochs: number,
  model: string = 'gpt-3.5-turbo'
): CostEstimate {
  const warnings: string[] = [];
  const pricing = OPENAI_PRICING[model];

  if (!pricing) {
    warnings.push(`Unknown OpenAI model: ${model}. Using gpt-3.5-turbo pricing.`);
  }

  const costPerMillion = pricing?.training || OPENAI_PRICING['gpt-3.5-turbo'].training;
  const trainingTokens = totalTokens * epochs;
  const estimatedCost = (trainingTokens / 1_000_000) * costPerMillion;
  const costPerEpoch = (totalTokens / 1_000_000) * costPerMillion;

  // OpenAI training is relatively fast
  const estimatedHours = trainingTokens / (1000 * 3600); // rough estimate

  return {
    provider: 'openai',
    totalTokens,
    trainingTokens,
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    currency: 'USD',
    breakdown: {
      epochs,
      costPerEpoch: Math.round(costPerEpoch * 100) / 100,
      estimatedHours: Math.round(estimatedHours * 10) / 10,
    },
    warnings,
  };
}

/**
 * Estimate training cost for RunPod
 */
export function estimateRunPodCost(
  totalTokens: number,
  epochs: number,
  gpuType: string = 'RTX 4090',
  tokensPerSecond?: number
): CostEstimate {
  const warnings: string[] = [];

  const hourlyRate = RUNPOD_GPU_PRICING[gpuType];
  if (!hourlyRate) {
    warnings.push(`Unknown GPU type: ${gpuType}. Using RTX 4090 pricing.`);
  }

  const rate = hourlyRate || RUNPOD_GPU_PRICING['RTX 4090'];
  const throughput = tokensPerSecond || GPU_THROUGHPUT[gpuType] || GPU_THROUGHPUT['RTX 4090'];

  const trainingTokens = totalTokens * epochs;
  const totalSeconds = trainingTokens / throughput;
  const totalHours = totalSeconds / 3600;
  const estimatedCost = totalHours * rate;
  const costPerEpoch = estimatedCost / epochs;

  if (totalHours > 24) {
    warnings.push(`Training may take ${Math.round(totalHours)} hours. Consider a larger GPU.`);
  }

  return {
    provider: 'runpod',
    totalTokens,
    trainingTokens,
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    currency: 'USD',
    breakdown: {
      epochs,
      costPerEpoch: Math.round(costPerEpoch * 100) / 100,
      estimatedHours: Math.round(totalHours * 10) / 10,
    },
    warnings,
  };
}

/**
 * Estimate training cost for local training
 */
export function estimateLocalCost(
  totalTokens: number,
  epochs: number,
  tokensPerSecond: number = LOCAL_TRAINING.defaultThroughput
): CostEstimate {
  const warnings: string[] = [];
  warnings.push('Local cost is approximate (electricity + GPU depreciation)');

  const trainingTokens = totalTokens * epochs;
  const totalSeconds = trainingTokens / tokensPerSecond;
  const totalHours = totalSeconds / 3600;
  const estimatedCost = totalHours * LOCAL_TRAINING.gpuHourCost;
  const costPerEpoch = estimatedCost / epochs;

  return {
    provider: 'local',
    totalTokens,
    trainingTokens,
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    currency: 'USD',
    breakdown: {
      epochs,
      costPerEpoch: Math.round(costPerEpoch * 100) / 100,
      estimatedHours: Math.round(totalHours * 10) / 10,
    },
    warnings,
  };
}

/**
 * Estimate training cost for any supported provider
 */
export function estimateTrainingCost(
  totalTokens: number,
  epochs: number,
  provider: 'openai' | 'runpod' | 'local',
  options?: CostEstimateOptions
): CostEstimate {
  const effectiveEpochs = options?.epochs || epochs;

  switch (provider) {
    case 'openai':
      return estimateOpenAICost(totalTokens, effectiveEpochs, options?.model);
    case 'runpod':
      return estimateRunPodCost(
        totalTokens,
        effectiveEpochs,
        options?.gpuType,
        options?.tokensPerSecond
      );
    case 'local':
      return estimateLocalCost(
        totalTokens,
        effectiveEpochs,
        options?.tokensPerSecond
      );
    default:
      return estimateLocalCost(totalTokens, effectiveEpochs);
  }
}

/**
 * Get available GPU types for RunPod
 */
export function getAvailableGPUs(): Array<{ name: string; hourlyRate: number; throughput: number }> {
  return Object.entries(RUNPOD_GPU_PRICING).map(([name, hourlyRate]) => ({
    name,
    hourlyRate,
    throughput: GPU_THROUGHPUT[name] || 100,
  }));
}

/**
 * Format cost estimate for display
 */
export function formatCostEstimate(estimate: CostEstimate): string {
  const lines = [
    `Provider: ${estimate.provider}`,
    `Total Tokens: ${estimate.totalTokens.toLocaleString()}`,
    `Training Tokens (${estimate.breakdown.epochs} epochs): ${estimate.trainingTokens.toLocaleString()}`,
    `Estimated Cost: $${estimate.estimatedCost.toFixed(2)} ${estimate.currency}`,
    `Cost per Epoch: $${estimate.breakdown.costPerEpoch.toFixed(2)}`,
    `Estimated Time: ${estimate.breakdown.estimatedHours} hours`,
  ];

  if (estimate.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    estimate.warnings.forEach(w => lines.push(`  - ${w}`));
  }

  return lines.join('\n');
}

/**
 * Compute enhanced dataset statistics for UI display
 * This runs client-side with character-based token estimation
 */
export interface DatasetExample {
  messages?: Array<{ role: string; content: string }>;
  text?: string;
  [key: string]: unknown;
}

export interface EnhancedStatsResult {
  token_count_total: number;
  token_count_avg: number;
  token_count_min: number;
  token_count_max: number;
  token_count_median: number;
  tokenizer_used: string;
  outliers: {
    count: number;
    indices: number[];
    method: 'iqr' | 'zscore';
  };
  quality_score: number;
  quality_issues: {
    empty_examples: number;
    malformed_examples: number;
    alternation_errors: number;
    duplicate_count: number;
  };
  cost_estimate?: {
    provider: string;
    estimated_cost: number;
    currency: string;
    epochs: number;
    estimated_hours?: number;
  };
}

/**
 * Estimate token count from text (chars / 4 approximation)
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Get text content from a dataset example
 */
function getExampleText(example: DatasetExample): string {
  if (example.messages && Array.isArray(example.messages)) {
    return example.messages.map(m => m.content || '').join(' ');
  }
  if (example.text && typeof example.text === 'string') {
    return example.text;
  }
  return JSON.stringify(example);
}

/**
 * Detect outliers using IQR method
 */
function detectOutliersIQR(tokenCounts: number[]): { indices: number[]; count: number } {
  if (tokenCounts.length < 10) {
    return { indices: [], count: 0 };
  }

  const sorted = [...tokenCounts].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n / 4)];
  const q3 = sorted[Math.floor(3 * n / 4)];
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const outlierIndices: number[] = [];
  tokenCounts.forEach((count, idx) => {
    if (count < lowerBound || count > upperBound) {
      outlierIndices.push(idx);
    }
  });

  return { indices: outlierIndices, count: outlierIndices.length };
}

/**
 * Calculate quality score (0-100)
 */
function calculateQualityScore(
  totalExamples: number,
  emptyExamples: number,
  malformedExamples: number,
  alternationErrors: number,
  duplicateCount: number
): number {
  if (totalExamples === 0) return 0;

  let score = 100;

  // Deduct for empty examples (5 points each, max 30)
  score -= Math.min(30, emptyExamples * 5);

  // Deduct for malformed examples (10 points each, max 40)
  score -= Math.min(40, malformedExamples * 10);

  // Deduct for alternation errors (3 points each, max 20)
  score -= Math.min(20, alternationErrors * 3);

  // Deduct for duplicates (1 point per 1% duplicates, max 10)
  const duplicatePercent = (duplicateCount / totalExamples) * 100;
  score -= Math.min(10, duplicatePercent);

  return Math.max(0, Math.round(score));
}

/**
 * Compute enhanced statistics for a dataset
 */
export function computeEnhancedStats(
  dataset: DatasetExample[],
  epochs: number = 3
): EnhancedStatsResult {
  if (!dataset || dataset.length === 0) {
    return {
      token_count_total: 0,
      token_count_avg: 0,
      token_count_min: 0,
      token_count_max: 0,
      token_count_median: 0,
      tokenizer_used: 'char/4 estimate',
      outliers: { count: 0, indices: [], method: 'iqr' },
      quality_score: 0,
      quality_issues: {
        empty_examples: 0,
        malformed_examples: 0,
        alternation_errors: 0,
        duplicate_count: 0,
      },
    };
  }

  // Calculate token counts for each example
  const tokenCounts: number[] = [];
  let emptyExamples = 0;
  let malformedExamples = 0;
  let alternationErrors = 0;
  const seenHashes = new Set<string>();
  let duplicateCount = 0;

  for (const example of dataset) {
    const text = getExampleText(example);
    const tokens = estimateTokens(text);
    tokenCounts.push(tokens);

    // Check for empty
    if (tokens === 0 || text.trim().length === 0) {
      emptyExamples++;
    }

    // Check for malformed (no messages or text)
    if (!example.messages && !example.text) {
      malformedExamples++;
    }

    // Check for role alternation errors in chat format
    if (example.messages && Array.isArray(example.messages)) {
      let lastRole = '';
      for (const msg of example.messages) {
        if (msg.role === lastRole && msg.role !== 'system') {
          alternationErrors++;
          break;
        }
        lastRole = msg.role;
      }
    }

    // Check for duplicates (simple hash)
    const hash = text.substring(0, 200);
    if (seenHashes.has(hash)) {
      duplicateCount++;
    } else {
      seenHashes.add(hash);
    }
  }

  // Calculate statistics
  const totalTokens = tokenCounts.reduce((a, b) => a + b, 0);
  const sortedCounts = [...tokenCounts].sort((a, b) => a - b);
  const median = sortedCounts[Math.floor(sortedCounts.length / 2)];

  // Detect outliers
  const outliers = detectOutliersIQR(tokenCounts);

  // Calculate quality score
  const qualityScore = calculateQualityScore(
    dataset.length,
    emptyExamples,
    malformedExamples,
    alternationErrors,
    duplicateCount
  );

  // Estimate cost (using RunPod RTX 4090 as default)
  const costEstimate = estimateRunPodCost(totalTokens, epochs, 'RTX 4090');

  return {
    token_count_total: totalTokens,
    token_count_avg: Math.round(totalTokens / dataset.length),
    token_count_min: Math.min(...tokenCounts),
    token_count_max: Math.max(...tokenCounts),
    token_count_median: median,
    tokenizer_used: 'char/4 estimate',
    outliers: {
      count: outliers.count,
      indices: outliers.indices.slice(0, 10), // Limit to first 10
      method: 'iqr',
    },
    quality_score: qualityScore,
    quality_issues: {
      empty_examples: emptyExamples,
      malformed_examples: malformedExamples,
      alternation_errors: alternationErrors,
      duplicate_count: duplicateCount,
    },
    cost_estimate: {
      provider: 'RunPod (RTX 4090)',
      estimated_cost: costEstimate.estimatedCost,
      currency: 'USD',
      epochs,
      estimated_hours: costEstimate.breakdown.estimatedHours,
    },
  };
}

console.log('[DatasetCostEstimator] Cost estimator loaded');
