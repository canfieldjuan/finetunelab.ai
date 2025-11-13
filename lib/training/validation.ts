'use client';

import type { ModelInfo } from '@/components/training/ModelSelector';
import type { LoRAConfig } from '@/components/training/LoRAConfig';
import type { DataStrategy } from '@/components/training/DataStrategySelector';
import type { DatasetExample } from '@/components/training/DatasetValidator';
import type { TrainingParams } from '@/components/training/TrainingParams';
import { isFormatCompatible, getIncompatibilityReason, type TrainingMethod } from '@/lib/training/format-validator';
import type { DatasetFormat } from '@/lib/training/dataset.types';

export interface TrainingConfig {
  model?: ModelInfo;
  lora?: LoRAConfig;
  data?: {
    strategy: DataStrategy;
  };
  dataset?: DatasetExample[];
  training?: TrainingParams;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

/**
 * Detect dataset format from examples structure
 */
function detectDatasetFormat(examples: DatasetExample[]): DatasetFormat | null {
  if (!examples || examples.length === 0) return null;

  const first = examples[0];

  // DPO format: prompt, chosen, rejected
  if ('prompt' in first && 'chosen' in first && 'rejected' in first) {
    return 'dpo';
  }

  // RLHF format: prompt, response (with optional reward)
  if ('prompt' in first && 'response' in first) {
    return 'rlhf';
  }

  // ChatML format: messages array with role/content
  if ('messages' in first && Array.isArray(first.messages)) {
    return 'chatml';
  }

  // ShareGPT format: conversations array
  if ('conversations' in first && Array.isArray(first.conversations)) {
    return 'sharegpt';
  }

  // Alpaca format: instruction, input, output
  if ('instruction' in first && 'output' in first) {
    return 'alpaca';
  }

  // OpenOrca format: system_prompt, question, response
  if ('system_prompt' in first && 'question' in first && 'response' in first) {
    return 'openorca';
  }

  // Unnatural Instructions: instruction, instances
  if ('instruction' in first && 'instances' in first) {
    return 'unnatural';
  }

  // Generic JSONL (text field)
  if ('text' in first) {
    return 'jsonl';
  }

  // Unknown format
  return null;
}

export function validateTrainingConfig(config: TrainingConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.model) {
    errors.push('Model selection is required');
  }

  if (!config.training?.method) {
    errors.push('Training method is required (SFT or DPO)');
  }

  if (!config.dataset || config.dataset.length === 0) {
    errors.push('Dataset is required');
  }

  // Validate dataset format compatibility with training method
  if (config.dataset && config.dataset.length > 0 && config.training?.method) {
    const detectedFormat = detectDatasetFormat(config.dataset);

    if (detectedFormat) {
      const trainingMethod = config.training.method as TrainingMethod;

      if (!isFormatCompatible(detectedFormat, trainingMethod)) {
        const reason = getIncompatibilityReason(detectedFormat, trainingMethod);
        errors.push(reason);
      }
    } else {
      warnings.push(
        'Could not detect dataset format. ' +
        'Ensure your dataset has the correct structure for the selected training method.'
      );
    }
  }

  if (config.model && config.data) {
    if (config.data.strategy === 'chat' && !config.model.supportsChatTemplate) {
      errors.push(
        `Model '${config.model.displayName}' does not support chat templates. ` +
        `Use 'standard' strategy or choose a different model.`
      );
    }
  }

  if (config.model && config.lora) {
    const expectedTargets = config.model.loraTargets;
    const providedTargets = config.lora.target_modules;

    const invalidTargets = providedTargets.filter((t) => !expectedTargets.includes(t));
    if (invalidTargets.length > 0) {
      errors.push(
        `Invalid LoRA target modules for ${config.model.displayName}: ${invalidTargets.join(', ')}. ` +
        `Expected: ${expectedTargets.join(', ')}`
      );
    }
  }

  if (config.dataset && config.dataset.length > 0 && config.data) {
    const firstExample = config.dataset[0];
    let detectedFormat: DataStrategy = 'standard';

    if ('messages' in firstExample && Array.isArray(firstExample.messages)) {
      detectedFormat = 'chat';
    } else if ('text' in firstExample) {
      detectedFormat = 'standard';
    }

    if (detectedFormat !== config.data.strategy) {
      errors.push(
        `Dataset format mismatch: Dataset is ${detectedFormat} format but ` +
        `strategy is set to ${config.data.strategy}. Either change strategy or convert dataset.`
      );
    }

    if (config.dataset.length < 10) {
      warnings.push(
        `Small dataset: Only ${config.dataset.length} examples. ` +
        `Recommend at least 10 examples for meaningful training.`
      );
    }
  }

  if (config.training) {
    if (config.training.num_epochs <= 0) {
      errors.push('Number of epochs must be positive');
    }

    if (config.training.num_epochs > 10) {
      warnings.push('High epoch count may lead to overfitting');
    }

    if (config.training.batch_size <= 0) {
      errors.push('Batch size must be positive');
    }

    if (config.training.learning_rate <= 0) {
      errors.push('Learning rate must be positive');
    }

    if (config.training.learning_rate > 0.001) {
      warnings.push('High learning rate may cause training instability');
    }
  }

  if (config.lora) {
    if (config.lora.r <= 0) {
      errors.push('LoRA rank (r) must be positive');
    }

    if (config.lora.r > 64) {
      warnings.push('High LoRA rank may increase training time and memory usage');
    }

    if (config.lora.alpha <= 0) {
      errors.push('LoRA alpha must be positive');
    }

    if (config.lora.dropout < 0 || config.lora.dropout > 1) {
      errors.push('LoRA dropout must be between 0 and 1');
    }
  }

  if (config.model && !config.model.isCached) {
    warnings.push(
      `Model '${config.model.displayName}' is not cached. ` +
      `First training run will download ${config.model.sizeGB} GB.`
    );
  }

  return {
    errors,
    warnings,
    isValid: errors.length === 0,
  };
}
