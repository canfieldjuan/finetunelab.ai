/**
 * Training Progress Calculator
 * Centralized utility functions for calculating training progress metrics
 *
 * Purpose: Single source of truth for all step/epoch/time/ETA calculations
 * Used by: TrainingDashboard
 * Date: 2025-12-06
 */

import type { MetricPoint } from '@/lib/hooks/useTrainingMetricsRealtime';

// ============================================================================
// Types
// ============================================================================

export type RawJobRow = Record<string, unknown>;

export interface ProgressMetrics {
  currentStep: number;
  totalSteps: number;
  currentEpoch: number;
  totalEpochs: number;
  progressPercent: number;
  elapsedSeconds: number | undefined;
  remainingSeconds: number | undefined;
  etaConfidence: 'high' | 'medium' | 'low' | 'insufficient_data';
  totalSamples: number | undefined;
  isValidated: boolean;
  validationNote: string | undefined;
}

export interface SmartETAResult {
  eta: number;
  confidence: 'high' | 'medium' | 'low' | 'insufficient_data';
  method: 'weighted_average' | 'linear' | 'fallback';
}

export interface ProgressValidation {
  isValid: boolean;
  calculatedTotal: number;
  observedMaxStep: number;
  suggestedTotal: number;
  discrepancyPercent: number;
}

// ============================================================================
// Helper Functions (moved from TrainingDashboard)
// ============================================================================

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

export const toStringValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const pickString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const result = toStringValue(value);
    if (result) return result;
  }
  return undefined;
};

export const maybeRecord = (value: unknown): Record<string, unknown> | undefined =>
  isRecord(value) ? value : undefined;

const sumIfNumbers = (a?: number, b?: number): number | undefined => {
  if (a === undefined || b === undefined) return undefined;
  const total = a + b;
  return Number.isFinite(total) ? total : undefined;
};

// ============================================================================
// Core Calculation Functions
// ============================================================================

/**
 * Compute elapsed seconds from timestamps
 * Falls back: completedAt -> updatedAt -> Date.now()
 */
export function computeElapsedSecondsFromTimestamps(
  startedAt?: string | null,
  completedAt?: string | null,
  updatedAt?: string | null
): number | undefined {
  if (!startedAt) return undefined;

  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return undefined;

  const endSource = completedAt ?? updatedAt;
  const end = endSource ? Date.parse(endSource) : Date.now();

  if (Number.isNaN(end) || end < start) return undefined;

  return Math.max(0, Math.round((end - start) / 1000));
}

/**
 * Simple linear ETA calculation (fallback)
 */
export function computeLinearRemainingSeconds(
  elapsedSeconds?: number,
  progressPercent?: number
): number | undefined {
  if (
    elapsedSeconds === undefined ||
    !Number.isFinite(elapsedSeconds) ||
    progressPercent === undefined ||
    !Number.isFinite(progressPercent) ||
    progressPercent <= 0 ||
    progressPercent >= 100
  ) {
    return undefined;
  }

  const perPercent = elapsedSeconds / progressPercent;
  const remaining = Math.round(perPercent * (100 - progressPercent));
  return remaining > 0 ? remaining : undefined;
}

/**
 * Extract dataset sample count from multiple possible locations
 * Tries 10+ locations for maximum compatibility
 */
export function extractDatasetSampleCount(
  raw: RawJobRow,
  config?: Record<string, unknown>
): number | undefined {
  const dataSection = maybeRecord(config?.data);
  const datasetSection = maybeRecord(config?.dataset);
  const metadataSection = maybeRecord(config?.metadata);
  const trainingSection = maybeRecord(config?.training);

  const candidateArrays = [
    Array.isArray(dataSection?.examples) ? dataSection?.examples.length : undefined,
    Array.isArray(datasetSection?.examples) ? datasetSection?.examples.length : undefined,
  ];

  const candidates = [
    toNumber(raw.total_samples),
    sumIfNumbers(toNumber(raw.train_samples), toNumber(raw.val_samples)),
    toNumber(dataSection?.dataset_size),
    toNumber(dataSection?.datasetSize),
    toNumber(dataSection?.total_examples),
    toNumber(datasetSection?.size),
    toNumber(datasetSection?.total_examples),
    toNumber(metadataSection?.total_examples),
    toNumber(metadataSection?.dataset_size),
    toNumber(trainingSection?.total_samples),
    ...candidateArrays,
  ];

  for (const value of candidates) {
    if (value && value > 0) {
      return Math.round(value);
    }
  }

  return undefined;
}

/**
 * Estimate total steps from config/raw data
 * Priority: explicit total_steps -> expected_total_steps -> calculated from formula
 */
export function estimateTotalSteps(
  raw: RawJobRow,
  sampleCount?: number,
  config?: Record<string, unknown>
): number | undefined {
  const trainingSection = maybeRecord(config?.training);

  // Try explicit candidates first
  const explicitCandidates = [
    toNumber(raw.total_steps),
    toNumber(raw.expected_total_steps),
    toNumber(trainingSection?.total_steps),
    toNumber(trainingSection?.max_steps),
    trainingSection && toNumber(trainingSection?.steps_per_epoch) && toNumber(trainingSection?.num_epochs)
      ? Number(toNumber(trainingSection?.steps_per_epoch)) * Number(toNumber(trainingSection?.num_epochs))
      : undefined,
  ];

  for (const candidate of explicitCandidates) {
    if (candidate && candidate > 0) {
      return Math.round(candidate);
    }
  }

  // Calculate from sample count, batch size, epochs
  if (!sampleCount || sampleCount <= 0) {
    return undefined;
  }

  const totalEpochs = toNumber(raw.total_epochs) ?? toNumber(trainingSection?.num_epochs);
  const batchSize = toNumber(raw.batch_size) ?? toNumber(trainingSection?.batch_size);
  const gradAccum = toNumber(raw.gradient_accumulation_steps) ??
                    toNumber(trainingSection?.gradient_accumulation_steps) ?? 1;

  if (!totalEpochs || !batchSize) {
    return undefined;
  }

  const effectiveBatch = batchSize * Math.max(gradAccum, 1);
  if (effectiveBatch <= 0) {
    return undefined;
  }

  const stepsPerEpoch = Math.ceil(sampleCount / effectiveBatch);
  if (stepsPerEpoch <= 0) {
    return undefined;
  }

  return stepsPerEpoch * totalEpochs;
}

// ============================================================================
// Smart ETA Calculation (NEW - Phase 3)
// ============================================================================

/**
 * Calculate Smart ETA using weighted moving average of recent step completion rates
 * Falls back to linear calculation if insufficient data
 */
export function calculateSmartETA(
  metrics: MetricPoint[],
  currentStep: number,
  totalSteps: number,
  elapsedSeconds: number
): SmartETAResult {
  const remainingSteps = totalSteps - currentStep;

  // Guard against invalid inputs
  if (remainingSteps <= 0 || totalSteps <= 0 || currentStep <= 0) {
    return { eta: 0, confidence: 'insufficient_data', method: 'fallback' };
  }

  // Need at least 5 metrics with timestamps for weighted average
  const metricsWithTimestamps = metrics.filter(m => m.timestamp && m.step > 0);

  if (metricsWithTimestamps.length < 5) {
    // Fall back to simple linear calculation
    const linearEta = computeLinearRemainingSeconds(elapsedSeconds, (currentStep / totalSteps) * 100);
    return {
      eta: linearEta ?? 0,
      confidence: 'insufficient_data',
      method: 'linear'
    };
  }

  // Calculate step completion rates from recent metrics (last 20 or all if fewer)
  const recentMetrics = metricsWithTimestamps.slice(-20);
  const stepRates: number[] = [];

  for (let i = 1; i < recentMetrics.length; i++) {
    const prevMetric = recentMetrics[i - 1];
    const currMetric = recentMetrics[i];

    const stepDelta = currMetric.step - prevMetric.step;
    const timeDelta = (new Date(currMetric.timestamp).getTime() -
                       new Date(prevMetric.timestamp).getTime()) / 1000;

    if (stepDelta > 0 && timeDelta > 0) {
      // Seconds per step
      stepRates.push(timeDelta / stepDelta);
    }
  }

  if (stepRates.length < 3) {
    // Not enough rate samples, fall back to linear
    const linearEta = computeLinearRemainingSeconds(elapsedSeconds, (currentStep / totalSteps) * 100);
    return {
      eta: linearEta ?? 0,
      confidence: 'low',
      method: 'linear'
    };
  }

  // Calculate weighted average (more weight to recent rates)
  // Weights: most recent gets highest weight
  const weights = stepRates.map((_, idx) => idx + 1); // [1, 2, 3, ..., n]
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const weightedAvgSecondsPerStep = stepRates.reduce((sum, rate, idx) => {
    return sum + (rate * weights[idx]);
  }, 0) / totalWeight;

  // Calculate ETA
  const eta = Math.round(remainingSteps * weightedAvgSecondsPerStep);

  // Calculate variance to determine confidence
  const mean = stepRates.reduce((a, b) => a + b, 0) / stepRates.length;
  const variance = stepRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / stepRates.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;

  // Confidence based on consistency of step rates
  let confidence: 'high' | 'medium' | 'low';
  if (coefficientOfVariation < 0.15) {
    confidence = 'high';
  } else if (coefficientOfVariation < 0.35) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return { eta, confidence, method: 'weighted_average' };
}

// ============================================================================
// Progress Validation (NEW - Phase 4)
// ============================================================================

/**
 * Validate calculated totalSteps against observed metrics
 * Auto-corrects if observed steps exceed calculated total
 */
export function validateProgress(
  calculatedTotalSteps: number,
  observedMaxStep: number,
  tolerance: number = 0.1
): ProgressValidation {
  // If no calculation or observation, nothing to validate
  if (!calculatedTotalSteps || calculatedTotalSteps <= 0) {
    return {
      isValid: true,
      calculatedTotal: calculatedTotalSteps,
      observedMaxStep,
      suggestedTotal: observedMaxStep > 0 ? observedMaxStep : calculatedTotalSteps,
      discrepancyPercent: 0
    };
  }

  if (!observedMaxStep || observedMaxStep <= 0) {
    return {
      isValid: true,
      calculatedTotal: calculatedTotalSteps,
      observedMaxStep: 0,
      suggestedTotal: calculatedTotalSteps,
      discrepancyPercent: 0
    };
  }

  const discrepancyPercent = ((observedMaxStep - calculatedTotalSteps) / calculatedTotalSteps) * 100;

  // If observed exceeds calculated by more than tolerance, calculation was wrong
  if (observedMaxStep > calculatedTotalSteps * (1 + tolerance)) {
    // Estimate true total: if we're at step X and that's Y% progress, total = X / Y * 100
    // Use observed step as minimum, extrapolate slightly for buffer
    const extrapolationBuffer = 1.05; // 5% buffer
    const suggestedTotal = Math.ceil(observedMaxStep * extrapolationBuffer);

    return {
      isValid: false,
      calculatedTotal: calculatedTotalSteps,
      observedMaxStep,
      suggestedTotal,
      discrepancyPercent
    };
  }

  return {
    isValid: true,
    calculatedTotal: calculatedTotalSteps,
    observedMaxStep,
    suggestedTotal: calculatedTotalSteps,
    discrepancyPercent
  };
}

// ============================================================================
// Combined Progress Metrics Calculator
// ============================================================================

/**
 * Calculate all progress metrics from job data and latest metric
 * Single source of truth - eliminates duplicate calculations
 */
export function calculateProgressMetrics(
  raw: RawJobRow,
  latestMetric: MetricPoint | null,
  allMetrics: MetricPoint[] = []
): ProgressMetrics {
  const config = maybeRecord(raw.config);

  // Extract base values
  const totalSamples = extractDatasetSampleCount(raw, config);
  const startedAt = toStringValue(raw.started_at);
  const completedAt = toStringValue(raw.completed_at);
  const updatedAt = toStringValue(raw.updated_at);

  // Calculate elapsed time
  const elapsedSeconds = toNumber(raw.elapsed_seconds) ??
                         computeElapsedSecondsFromTimestamps(startedAt, completedAt, updatedAt);

  // Calculate total steps
  let calculatedTotalSteps = estimateTotalSteps(raw, totalSamples, config) ?? 0;

  // Get current step from metric or job data
  const currentStepFromMetric = latestMetric?.step ?? 0;
  const currentStepFromJob = toNumber(raw.current_step) ?? 0;
  const currentStep = Math.max(currentStepFromMetric, currentStepFromJob);

  // Get observed max step from all metrics
  const observedMaxStep = allMetrics.length > 0
    ? Math.max(...allMetrics.map(m => m.step))
    : currentStep;

  // Validate and potentially correct total steps
  const validation = validateProgress(calculatedTotalSteps, observedMaxStep);
  let validationNote: string | undefined;

  if (!validation.isValid) {
    calculatedTotalSteps = validation.suggestedTotal;
    validationNote = `Adjusted total from ${validation.calculatedTotal} to ${validation.suggestedTotal} (observed step ${validation.observedMaxStep})`;
    console.log('[ProgressCalculator] Validation correction:', validationNote);
  }

  const totalSteps = calculatedTotalSteps;

  // Calculate progress percentage
  const progressPercent = totalSteps > 0 && currentStep > 0
    ? Math.min(100, (currentStep / totalSteps) * 100)
    : toNumber(raw.progress) ?? 0;

  // Get epochs
  const currentEpoch = toNumber(raw.current_epoch) ??
                       (latestMetric?.epoch ?? 0);
  const totalEpochs = toNumber(raw.total_epochs) ?? 1;

  // Calculate Smart ETA if we have enough data
  let remainingSeconds: number | undefined;
  let etaConfidence: 'high' | 'medium' | 'low' | 'insufficient_data' = 'insufficient_data';

  if (elapsedSeconds && totalSteps > 0 && currentStep > 0) {
    const smartEta = calculateSmartETA(allMetrics, currentStep, totalSteps, elapsedSeconds);
    remainingSeconds = smartEta.eta > 0 ? smartEta.eta : undefined;
    etaConfidence = smartEta.confidence;

    // Fall back to stored remaining_seconds if smart calculation fails
    if (remainingSeconds === undefined) {
      remainingSeconds = toNumber(raw.remaining_seconds);
    }
  } else {
    // Use stored or linear calculation as fallback
    remainingSeconds = toNumber(raw.remaining_seconds) ??
                       computeLinearRemainingSeconds(elapsedSeconds, progressPercent);
  }

  return {
    currentStep,
    totalSteps,
    currentEpoch,
    totalEpochs,
    progressPercent,
    elapsedSeconds,
    remainingSeconds,
    etaConfidence,
    totalSamples,
    isValidated: validation.isValid,
    validationNote
  };
}
