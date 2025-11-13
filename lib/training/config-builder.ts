// Centralized Training Config Builder
// Purpose: Build, normalize, and validate training configs from UI state
// Notes:
// - Adds robust debug logging
// - Avoids mutating inputs
// - Keeps defaults conservative (only when missing)

import type { TrainingConfig } from './training-config.types';
import { configValidator } from './config-validator';

function log(...args: any[]) {
  // Single place to toggle builder logs if needed
  console.log('[ConfigBuilder]', ...args);
}

export function buildUiConfig(input: TrainingConfig): TrainingConfig {
  log('buildUiConfig: start');
  const cfg: TrainingConfig = JSON.parse(JSON.stringify(input));

  if (!cfg.training) {
    // Ensure training object exists
    (cfg as any).training = {};
  }

  // Do not inject values unless clearly missing
  // Provide safe defaults only when absent and required downstream
  if ((cfg.training as any).method === undefined) {
    (cfg.training as any).method = 'sft';
  }

  log('buildUiConfig: done');
  return cfg;
}

export function normalizeForBackend(config: TrainingConfig): any {
  log('normalizeForBackend: start');
  const cfg = buildUiConfig(config);

  const t: any = { ...(cfg.training as any) };
  const hasLoRA = t.use_lora || t.lora_r || t.lora_alpha || t.lora_dropout;

  const out: any = {
    model: cfg.model,
    tokenizer: cfg.tokenizer,
    data: cfg.data,
    training: t,
  };

  // Map training.lora_* to top-level lora if present
  if (hasLoRA) {
    const r = t.lora_r;
    const alpha = t.lora_alpha;
    const dropout = t.lora_dropout;
    if (r && alpha) {
      out.lora = { r, alpha, dropout: dropout ?? 0.05 };
    }

    // Remove UI-specific LoRA keys from training copy
    delete out.training.lora_r;
    delete out.training.lora_alpha;
    delete out.training.lora_dropout;
  }

  log('normalizeForBackend: done');
  return out;
}

export function createSubmissionPayload(opts: {
  config: TrainingConfig;
  datasetPath: string;
  executionId: string;
  name?: string;
  datasetContent?: any[];
}) {
  log('createSubmissionPayload:', { exec: opts.executionId });
  const normalized = normalizeForBackend(opts.config);
  return {
    config: normalized,
    dataset_path: opts.datasetPath,
    execution_id: opts.executionId,
    name: opts.name,
    dataset_content: opts.datasetContent,
  };
}

export function validateBeforeUse(config: TrainingConfig) {
  log('validateBeforeUse: start');
  const result = configValidator.validate(config);
  log('validateBeforeUse: results', {
    isValid: result.isValid,
    errors: result.errors.length,
    warnings: result.warnings.length,
  });
  return result;
}

log('module loaded');

