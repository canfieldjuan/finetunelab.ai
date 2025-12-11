/**
 * Training Predictions Configuration
 *
 * Validates and normalizes predictions configuration with cost controls.
 * All limits are configurable via environment variables (no hardcoded values).
 */

import type { PredictionsConfig } from './types/predictions-types';

export interface PredictionsConfigLimits {
  enabled: boolean;
  default_sample_count: number;
  max_sample_count: number;
  default_frequency: 'epoch' | 'eval' | 'steps';
  min_step_interval: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  config?: PredictionsConfig;
}

/**
 * Load configuration limits from environment variables
 */
export function loadPredictionsLimits(): PredictionsConfigLimits {
  return {
    enabled: process.env.PREDICTIONS_ENABLED === 'true',
    default_sample_count: parseInt(
      process.env.PREDICTIONS_DEFAULT_SAMPLE_COUNT || '5',
      10
    ),
    max_sample_count: parseInt(
      process.env.PREDICTIONS_MAX_SAMPLE_COUNT || '100',
      10
    ),
    default_frequency: (
      process.env.PREDICTIONS_DEFAULT_FREQUENCY || 'epoch'
    ) as 'epoch' | 'eval' | 'steps',
    min_step_interval: parseInt(
      process.env.PREDICTIONS_MIN_STEP_INTERVAL || '10',
      10
    ),
  };
}

/**
 * Validate predictions configuration against system limits
 */
export function validatePredictionsConfig(
  userConfig: Partial<PredictionsConfig> | unknown,
  limits?: PredictionsConfigLimits
): ValidationResult {
  const configLimits = limits || loadPredictionsLimits();
  const errors: ValidationError[] = [];

  if (!userConfig || typeof userConfig !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'config', message: 'Invalid configuration object' }],
    };
  }

  const config = userConfig as Partial<PredictionsConfig>;

  const enabled = typeof config.enabled === 'boolean'
    ? config.enabled
    : configLimits.enabled;

  if (!enabled) {
    return {
      valid: true,
      errors: [],
      config: {
        enabled: false,
        sample_count: 0,
        sample_frequency: configLimits.default_frequency,
      },
    };
  }

  const sample_count = config.sample_count
    ?? configLimits.default_sample_count;

  if (
    typeof sample_count !== 'number' ||
    sample_count < 1 ||
    !Number.isInteger(sample_count)
  ) {
    errors.push({
      field: 'sample_count',
      message: 'Sample count must be a positive integer',
    });
  }

  if (sample_count > configLimits.max_sample_count) {
    errors.push({
      field: 'sample_count',
      message: `Sample count cannot exceed ${configLimits.max_sample_count}`,
    });
  }

  const sample_frequency = config.sample_frequency
    ?? configLimits.default_frequency;

  if (sample_frequency !== 'epoch' && sample_frequency !== 'eval' && sample_frequency !== 'steps') {
    errors.push({
      field: 'sample_frequency',
      message: 'Frequency must be "epoch", "eval", or "steps"',
    });
  }

  let step_interval: number | undefined;
  if (sample_frequency === 'steps') {
    step_interval = config.step_interval;

    if (
      typeof step_interval !== 'number' ||
      step_interval < configLimits.min_step_interval ||
      !Number.isInteger(step_interval)
    ) {
      errors.push({
        field: 'step_interval',
        message: `Step interval must be at least ${configLimits.min_step_interval}`,
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    config: {
      enabled: true,
      sample_count,
      sample_frequency,
      step_interval,
    },
  };
}
