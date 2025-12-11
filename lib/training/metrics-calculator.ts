/**
 * Training Metrics Calculator
 * Shared utility functions for calculating derived training metrics
 * Used by: TrainingDashboard, FinetunedModelCard
 * Date: 2025-12-05
 */

export interface TrainingMetrics {
  final_loss?: number | null;
  final_eval_loss?: number | null;
  loss_trend?: string | null;
  perplexity?: number | null;
  train_perplexity?: number | null;
  epochs_without_improvement?: number | null;
  best_eval_loss?: number | null;
}

export interface LossGap {
  gap: number;
  status: 'good' | 'warning' | 'bad';
}

export interface PerplexityStatus {
  value: number;
  status: 'excellent' | 'good' | 'poor';
}

export interface LossTrendStatus {
  trend: string;
  status: 'good' | 'warning' | 'bad';
}

export interface EpochsWithoutImprovementStatus {
  value: number;
  status: 'good' | 'warning' | 'bad';
}

/**
 * Calculate train/eval loss gap (overfitting indicator)
 *
 * Gap = final_loss - final_eval_loss
 * - gap < 0.3: Good generalization (green)
 * - gap 0.3-0.5: Slight overfitting (yellow)
 * - gap > 0.5: Severe overfitting (red)
 */
export function calculateLossGap(metrics: TrainingMetrics): LossGap | null {
  if (metrics.final_loss != null && metrics.final_eval_loss != null) {
    const gap = metrics.final_loss - metrics.final_eval_loss;

    if (gap < 0.3) {
      return { gap, status: 'good' };
    } else if (gap < 0.5) {
      return { gap, status: 'warning' };
    } else {
      return { gap, status: 'bad' };
    }
  }

  return null;
}

/**
 * Get perplexity status with color coding
 *
 * Perplexity indicates model "confusion" (lower = better)
 * - < 5: Excellent (green)
 * - 5-10: Good (yellow)
 * - > 10: Poor (red)
 */
export function getPerplexityStatus(metrics: TrainingMetrics): PerplexityStatus | null {
  const perplexity = metrics.perplexity ?? metrics.train_perplexity;

  if (perplexity == null) {
    return null;
  }

  if (perplexity < 5) {
    return { value: perplexity, status: 'excellent' };
  } else if (perplexity < 10) {
    return { value: perplexity, status: 'good' };
  } else {
    return { value: perplexity, status: 'poor' };
  }
}

/**
 * Get loss trend status
 *
 * Loss trend shows training productivity
 * - improving: Training is productive (green)
 * - stable: Training has plateaued (yellow)
 * - diverging/degrading: Training is failing (red)
 */
export function getLossTrendStatus(metrics: TrainingMetrics): LossTrendStatus | null {
  const trend = metrics.loss_trend;

  if (!trend) {
    return null;
  }

  const trendLower = trend.toLowerCase();

  if (trendLower === 'improving') {
    return { trend, status: 'good' };
  } else if (trendLower === 'stable') {
    return { trend, status: 'warning' };
  } else {
    // diverging, degrading, etc.
    return { trend, status: 'bad' };
  }
}

/**
 * Get epochs without improvement status
 *
 * Shows recent eval trend (binary indicator)
 * Note: epochs_without_improvement is BINARY (0 or 1), not cumulative
 * - 0: Last eval improved vs previous eval (green)
 * - 1: Last eval did not improve vs previous eval (yellow)
 */
export function getEpochsWithoutImprovementStatus(
  metrics: TrainingMetrics
): EpochsWithoutImprovementStatus | null {
  const epochs = metrics.epochs_without_improvement;

  if (epochs == null) {
    return null;
  }

  // Binary logic: 0 = improved, 1 = did not improve
  if (epochs === 0) {
    return { value: epochs, status: 'good' };
  } else {
    // epochs === 1 (or any non-zero value means no improvement)
    return { value: epochs, status: 'warning' };
  }
}

/**
 * Calculate training duration from timestamps
 */
export function calculateTrainingDuration(
  startedAt?: string | null,
  completedAt?: string | null
): string {
  if (!startedAt || !completedAt) {
    return 'Unknown';
  }

  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const durationMs = end - start;
  const minutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${minutes}m`;
}

/**
 * Get CSS color classes for status
 */
export function getStatusColorClasses(status: 'good' | 'warning' | 'bad' | 'excellent' | 'poor'): string {
  switch (status) {
    case 'good':
    case 'excellent':
      return 'text-green-600 dark:text-green-400';
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'bad':
    case 'poor':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

/**
 * Get background color classes for status cards
 */
export function getStatusBgClasses(status: 'good' | 'warning' | 'bad' | 'excellent' | 'poor'): string {
  switch (status) {
    case 'good':
    case 'excellent':
      return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
    case 'warning':
      return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
    case 'bad':
    case 'poor':
      return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
    default:
      return 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800';
  }
}
