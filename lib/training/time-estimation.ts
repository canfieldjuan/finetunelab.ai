/**
 * Training Time Estimation & Budget Management
 * Estimates training duration and costs based on configuration
 * Date: 2025-10-31
 */

import type { TrainingConfig } from './training-config.types';

// GPU Performance Benchmarks (tokens/second for different models)
export interface GPUBenchmark {
  name: string;
  tflops: number;           // Theoretical TFLOPS
  vram_gb: number;          // VRAM in GB
  tokens_per_sec_7b: number;   // Tokens/sec for 7B model
  tokens_per_sec_13b: number;  // Tokens/sec for 13B model
  tokens_per_sec_70b: number;  // Tokens/sec for 70B model
  cost_per_hour?: number;   // Cloud cost per hour (if applicable)
}

export const GPU_BENCHMARKS: Record<string, GPUBenchmark> = {
  // Consumer GPUs (Local)
  'rtx4060ti': {
    name: 'RTX 4060 Ti',
    tflops: 22.1,
    vram_gb: 16,
    tokens_per_sec_7b: 45,
    tokens_per_sec_13b: 22,
    tokens_per_sec_70b: 0, // Not enough VRAM
    cost_per_hour: 0, // Local - no cost
  },
  'rtx4090': {
    name: 'RTX 4090',
    tflops: 82.6,
    vram_gb: 24,
    tokens_per_sec_7b: 120,
    tokens_per_sec_13b: 65,
    tokens_per_sec_70b: 12,
    cost_per_hour: 0,
  },
  'rtx3090': {
    name: 'RTX 3090',
    tflops: 35.6,
    vram_gb: 24,
    tokens_per_sec_7b: 65,
    tokens_per_sec_13b: 35,
    tokens_per_sec_70b: 8,
    cost_per_hour: 0,
  },

  // Cloud GPUs - GPU_PRICING_TIERS IDs (lowercase for lookup)
  'rtx_a4000': {
    name: 'RTX A4000',
    tflops: 19.2,
    vram_gb: 16,
    tokens_per_sec_7b: 40,
    tokens_per_sec_13b: 20,
    tokens_per_sec_70b: 0,
    cost_per_hour: 0.34,
  },
  'rtx_a5000': {
    name: 'RTX A5000',
    tflops: 27.8,
    vram_gb: 24,
    tokens_per_sec_7b: 55,
    tokens_per_sec_13b: 30,
    tokens_per_sec_70b: 6,
    cost_per_hour: 0.49,
  },
  'rtx_a6000': {
    name: 'RTX A6000',
    tflops: 38.7,
    vram_gb: 48,
    tokens_per_sec_7b: 90,
    tokens_per_sec_13b: 48,
    tokens_per_sec_70b: 10,
    cost_per_hour: 0.79,
  },
  'a100_pcie': {
    name: 'A100 PCIe',
    tflops: 312,
    vram_gb: 40,
    tokens_per_sec_7b: 280,
    tokens_per_sec_13b: 150,
    tokens_per_sec_70b: 35,
    cost_per_hour: 1.89,
  },
  'a100_sxm': {
    name: 'A100 SXM',
    tflops: 312,
    vram_gb: 80,
    tokens_per_sec_7b: 300,
    tokens_per_sec_13b: 160,
    tokens_per_sec_70b: 45,
    cost_per_hour: 2.89,
  },
  'h100_pcie': {
    name: 'H100 PCIe',
    tflops: 989,
    vram_gb: 80,
    tokens_per_sec_7b: 450,
    tokens_per_sec_13b: 240,
    tokens_per_sec_70b: 65,
    cost_per_hour: 4.89,
  },

  // Legacy cloud GPU keys (for backward compatibility)
  'rtx4090-cloud': {
    name: 'RTX 4090 (Cloud)',
    tflops: 82.6,
    vram_gb: 24,
    tokens_per_sec_7b: 120,
    tokens_per_sec_13b: 65,
    tokens_per_sec_70b: 12,
    cost_per_hour: 0.59,
  },
  'rtx-a6000': {
    name: 'RTX A6000',
    tflops: 38.7,
    vram_gb: 48,
    tokens_per_sec_7b: 90,
    tokens_per_sec_13b: 48,
    tokens_per_sec_70b: 10,
    cost_per_hour: 0.79,
  },
  'a100-40gb': {
    name: 'A100 40GB',
    tflops: 312,
    vram_gb: 40,
    tokens_per_sec_7b: 280,
    tokens_per_sec_13b: 150,
    tokens_per_sec_70b: 35,
    cost_per_hour: 0.89,
  },
  'a100-80gb': {
    name: 'A100 80GB',
    tflops: 312,
    vram_gb: 80,
    tokens_per_sec_7b: 280,
    tokens_per_sec_13b: 150,
    tokens_per_sec_70b: 40,
    cost_per_hour: 1.39,
  },
  'h100': {
    name: 'H100',
    tflops: 989,
    vram_gb: 80,
    tokens_per_sec_7b: 450,
    tokens_per_sec_13b: 240,
    tokens_per_sec_70b: 65,
    cost_per_hour: 2.95,
  },
  't4': {
    name: 'T4',
    tflops: 65,
    vram_gb: 16,
    tokens_per_sec_7b: 35,
    tokens_per_sec_13b: 18,
    tokens_per_sec_70b: 0,
    cost_per_hour: 0.20,
  },
  'l4': {
    name: 'L4',
    tflops: 121,
    vram_gb: 24,
    tokens_per_sec_7b: 85,
    tokens_per_sec_13b: 45,
    tokens_per_sec_70b: 10,
    cost_per_hour: 0.44,
  },
};

// Model size categories (billion parameters)
export interface ModelSize {
  min_params: number;
  max_params: number;
  category: '< 1B' | '1-3B' | '3-7B' | '7-13B' | '13-30B' | '30-70B' | '70B+';
}

export const MODEL_SIZES: ModelSize[] = [
  { min_params: 0, max_params: 1, category: '< 1B' },
  { min_params: 1, max_params: 3, category: '1-3B' },
  { min_params: 3, max_params: 7, category: '3-7B' },
  { min_params: 7, max_params: 13, category: '7-13B' },
  { min_params: 13, max_params: 30, category: '13-30B' },
  { min_params: 30, max_params: 70, category: '30-70B' },
  { min_params: 70, max_params: Infinity, category: '70B+' },
];

/**
 * Training time estimation result
 */
export interface TimeEstimation {
  estimated_hours: number;
  estimated_minutes: number;
  estimated_cost?: number;
  tokens_processed: number;
  effective_batch_size: number;
  total_steps: number;
  gpu_utilization: number;
  warnings: string[];
  can_fit_in_vram: boolean;
  recommended_settings?: {
    batch_size?: number;
    gradient_accumulation_steps?: number;
    use_lora?: boolean;
  };
}

/**
 * Budget limit configuration
 */
export interface BudgetLimit {
  max_hours?: number;
  max_cost?: number;
  warn_at_percent?: number; // Warn when reaching X% of budget
  auto_stop?: boolean;      // Auto-stop when budget reached
}

/**
 * Estimate model size category from model name
 */
export function estimateModelSize(modelName: string): ModelSize {
  // Extract number from model name (e.g., "llama-2-7b" -> 7)
  const match = modelName.toLowerCase().match(/(\d+\.?\d*)b/);
  
  if (!match) {
    // Default to small model if can't determine
    return MODEL_SIZES[2]; // 3-7B
  }
  
  const params = parseFloat(match[1]);
  return MODEL_SIZES.find(size => params >= size.min_params && params < size.max_params) || MODEL_SIZES[2];
}

/**
 * Get tokens per second for a model size on a specific GPU
 */
function getTokensPerSecond(gpu: GPUBenchmark, modelSize: ModelSize): number {
  const category = modelSize.category;
  
  if (category === '< 1B' || category === '1-3B' || category === '3-7B') {
    return gpu.tokens_per_sec_7b;
  } else if (category === '7-13B' || category === '13-30B') {
    return gpu.tokens_per_sec_13b;
  } else {
    return gpu.tokens_per_sec_70b;
  }
}

/**
 * Check if model can fit in GPU VRAM
 */
export function checkVRAMFit(
  modelName: string,
  gpuVramGB: number,
  useLora: boolean,
  batchSize: number
): { fits: boolean; estimated_vram_gb: number; recommendations: string[] } {
  const modelSize = estimateModelSize(modelName);
  const recommendations: string[] = [];
  
  // Base VRAM calculation (rough estimate)
  // Full precision: ~2 bytes per parameter
  // Float16: ~2 bytes per parameter
  // With optimizer states: ~4x model size
  
  let estimatedVRAM: number;
  const params = (modelSize.min_params + modelSize.max_params) / 2; // Average
  
  if (useLora) {
    // LoRA uses much less VRAM
    estimatedVRAM = (params * 2) / 1024 + (batchSize * 0.5); // Model + batch overhead
  } else {
    // Full fine-tuning
    estimatedVRAM = (params * 2 * 4) / 1024 + (batchSize * 1.0); // Model + optimizer + batch
  }
  
  const fits = estimatedVRAM <= gpuVramGB * 0.9; // Leave 10% headroom
  
  if (!fits) {
    if (!useLora) {
      recommendations.push('Enable LoRA to reduce VRAM usage by 75%');
    }
    if (batchSize > 1) {
      recommendations.push(`Reduce batch size to ${Math.max(1, Math.floor(batchSize / 2))}`);
    }
    recommendations.push('Consider using gradient checkpointing');
    recommendations.push('Use a smaller model or upgrade GPU');
  }
  
  return {
    fits,
    estimated_vram_gb: estimatedVRAM,
    recommendations,
  };
}

/**
 * Estimate training time and cost
 */
export function estimateTrainingTime(
  config: TrainingConfig,
  gpuType: string,
  datasetSize?: number
): TimeEstimation {
  const warnings: string[] = [];
  const gpu = GPU_BENCHMARKS[gpuType.toLowerCase()] || GPU_BENCHMARKS['rtx4060ti'];
  const modelSize = estimateModelSize(config.model.name);
  
  // Calculate effective batch size
  const effectiveBatchSize = config.training.batch_size * 
                            (config.training.gradient_accumulation_steps || 1);
  
  // Estimate dataset size if not provided
  const estimatedSamples = datasetSize || config.data.max_samples || 1000;

  // Calculate tokens to process
  const tokensPerSample = config.training.max_length;
  const totalTokens = estimatedSamples * tokensPerSample * config.training.num_epochs;

  // Calculate training steps
  const totalSteps = Math.ceil(estimatedSamples / effectiveBatchSize) * config.training.num_epochs;
  
  // Get GPU performance
  const tokensPerSec = getTokensPerSecond(gpu, modelSize);
  
  if (tokensPerSec === 0) {
    warnings.push(`⚠️ ${gpu.name} may not have enough VRAM for ${modelSize.category} models`);
  }
  
  // Check VRAM fit
  const vramCheck = checkVRAMFit(
    config.model.name,
    gpu.vram_gb,
    config.training.use_lora,
    config.training.batch_size
  );
  
  if (!vramCheck.fits) {
    warnings.push(`⚠️ Model may not fit in ${gpu.vram_gb}GB VRAM (estimated ${vramCheck.estimated_vram_gb.toFixed(1)}GB needed)`);
    warnings.push(...vramCheck.recommendations);
  }
  
  // Estimate time (with overhead multiplier for I/O, logging, etc.)
  const overheadMultiplier = 1.3; // 30% overhead
  const estimatedSeconds = tokensPerSec > 0 
    ? (totalTokens / tokensPerSec) * overheadMultiplier
    : 0;
  
  const estimatedHours = estimatedSeconds / 3600;
  const estimatedMinutes = (estimatedSeconds % 3600) / 60;
  
  // GPU utilization estimate
  let gpuUtilization = 85; // Base utilization
  if (config.training.batch_size === 1) {
    gpuUtilization -= 20;
    warnings.push('💡 Batch size of 1 is inefficient. Consider increasing to 4-8 for better GPU utilization.');
  }
  if (config.training.gradient_accumulation_steps && config.training.gradient_accumulation_steps > 1) {
    gpuUtilization += 5; // Gradient accumulation helps utilization
  }
  
  // Cost estimation
  const estimatedCost = gpu.cost_per_hour ? gpu.cost_per_hour * estimatedHours : undefined;
  
  // Generate recommendations
  const recommended_settings: TimeEstimation['recommended_settings'] = {};
  if (!vramCheck.fits) {
    if (!config.training.use_lora) {
      recommended_settings.use_lora = true;
    }
    if (config.training.batch_size > 2) {
      recommended_settings.batch_size = Math.max(1, Math.floor(config.training.batch_size / 2));
      recommended_settings.gradient_accumulation_steps = (config.training.gradient_accumulation_steps || 1) * 2;
    }
  }
  
  return {
    estimated_hours: Math.floor(estimatedHours),
    estimated_minutes: Math.floor(estimatedMinutes),
    estimated_cost: estimatedCost,
    tokens_processed: totalTokens,
    effective_batch_size: effectiveBatchSize,
    total_steps: totalSteps,
    gpu_utilization: gpuUtilization,
    warnings,
    can_fit_in_vram: vramCheck.fits,
    recommended_settings: Object.keys(recommended_settings).length > 0 ? recommended_settings : undefined,
  };
}

/**
 * Check if training will exceed budget
 */
export function checkBudgetExceeded(
  estimation: TimeEstimation,
  budget: BudgetLimit
): { exceeded: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let exceeded = false;
  
  // Check time limit
  if (budget.max_hours !== undefined) {
    const totalHours = estimation.estimated_hours + (estimation.estimated_minutes / 60);
    const warnThreshold = budget.warn_at_percent || 80;
    const warnHours = budget.max_hours * (warnThreshold / 100);
    
    if (totalHours > budget.max_hours) {
      exceeded = true;
      warnings.push(`⛔ Training will take ${totalHours.toFixed(1)}h, exceeding your ${budget.max_hours}h limit`);
    } else if (totalHours > warnHours) {
      warnings.push(`⚠️ Training will use ${((totalHours / budget.max_hours) * 100).toFixed(0)}% of your ${budget.max_hours}h budget`);
    }
  }
  
  // Check cost limit
  if (budget.max_cost !== undefined && estimation.estimated_cost !== undefined) {
    const warnThreshold = budget.warn_at_percent || 80;
    const warnCost = budget.max_cost * (warnThreshold / 100);
    
    if (estimation.estimated_cost > budget.max_cost) {
      exceeded = true;
      warnings.push(`⛔ Training will cost $${estimation.estimated_cost.toFixed(2)}, exceeding your $${budget.max_cost.toFixed(2)} limit`);
    } else if (estimation.estimated_cost > warnCost) {
      warnings.push(`⚠️ Training will use ${((estimation.estimated_cost / budget.max_cost) * 100).toFixed(0)}% of your $${budget.max_cost.toFixed(2)} budget`);
    }
  }
  
  return { exceeded, warnings };
}

/**
 * Format time estimation for display
 */
export function formatTimeEstimate(estimation: TimeEstimation): string {
  if (estimation.estimated_hours === 0) {
    return `~${estimation.estimated_minutes} minutes`;
  } else if (estimation.estimated_hours < 1) {
    return `~${estimation.estimated_minutes} minutes`;
  } else {
    return `~${estimation.estimated_hours}h ${estimation.estimated_minutes}m`;
  }
}

/**
 * Get recommended GPU for model and budget
 */
export function recommendGPU(
  modelName: string,
  budgetPerHour?: number
): { recommended: string; alternatives: string[]; reason: string } {
  const modelSize = estimateModelSize(modelName);
  const gpus = Object.entries(GPU_BENCHMARKS);
  
  // Filter GPUs that can handle the model
  const compatibleGPUs = gpus.filter(([, gpu]) => {
    const tokensPerSec = getTokensPerSecond(gpu, modelSize);
    return tokensPerSec > 0;
  });
  
  if (compatibleGPUs.length === 0) {
    return {
      recommended: 'h100',
      alternatives: ['a100-80gb'],
      reason: 'Model is very large and requires high-end GPUs',
    };
  }
  
  // If budget specified, prefer GPUs within budget
  if (budgetPerHour !== undefined) {
    const affordableGPUs = compatibleGPUs.filter(([, gpu]) => 
      !gpu.cost_per_hour || gpu.cost_per_hour <= budgetPerHour
    );
    
    if (affordableGPUs.length > 0) {
      // Sort by performance (tokens/sec)
      affordableGPUs.sort((a, b) => {
        const tokensA = getTokensPerSecond(a[1], modelSize);
        const tokensB = getTokensPerSecond(b[1], modelSize);
        return tokensB - tokensA;
      });
      
      return {
        recommended: affordableGPUs[0][0],
        alternatives: affordableGPUs.slice(1, 3).map(([key]) => key),
        reason: `Best performance within $${budgetPerHour}/hour budget`,
      };
    }
  }
  
  // No budget constraint - recommend best value (performance/cost ratio)
  const rankedGPUs = compatibleGPUs
    .filter(([, gpu]) => gpu.cost_per_hour && gpu.cost_per_hour > 0)
    .map(([key, gpu]) => {
      const tokensPerSec = getTokensPerSecond(gpu, modelSize);
      const valueScore = tokensPerSec / (gpu.cost_per_hour || 1);
      return { key, valueScore };
    })
    .sort((a, b) => b.valueScore - a.valueScore);
  
  if (rankedGPUs.length > 0) {
    return {
      recommended: rankedGPUs[0].key,
      alternatives: rankedGPUs.slice(1, 3).map(gpu => gpu.key),
      reason: 'Best performance/cost ratio',
    };
  }
  
  // Fallback to local GPUs
  return {
    recommended: 'rtx4090',
    alternatives: ['rtx4060ti', 'rtx3090'],
    reason: 'Local GPU - no cloud costs',
  };
}

console.log('[TimeEstimation] Time estimation utilities loaded');
