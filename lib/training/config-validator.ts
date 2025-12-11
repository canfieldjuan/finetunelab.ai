// Training Config Validator
// Validates training configurations before save/download
// Date: 2025-10-16

import type { TrainingConfig, BaseTrainingConfig, ModelConfig, TokenizerConfig, DataConfig } from './training-config.types';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export class TrainingConfigValidator {
  validate(config: TrainingConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    console.log('[ConfigValidator] Validating config');

    this.validateModel(config.model, errors, warnings);
    this.validateTokenizer(config.tokenizer, errors, warnings);
    this.validateTraining(config.training, errors, warnings);
    this.validateData(config.data, errors, warnings);

    const isValid = errors.length === 0;
    console.log('[ConfigValidator] Result:', { isValid, errorCount: errors.length, warningCount: warnings.length });

    return { isValid, errors, warnings };
  }

  private validateModel(model: ModelConfig, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!model.name || typeof model.name !== 'string') {
      errors.push({
        field: 'model.name',
        message: 'Model name is required',
        severity: 'error'
      });
    }

    if (model.torch_dtype === 'float32') {
      warnings.push({
        field: 'model.torch_dtype',
        message: 'float32 uses more VRAM. Consider float16 for 8GB GPUs',
        severity: 'warning'
      });
    }
  }

  private validateTokenizer(tokenizer: TokenizerConfig, errors: ValidationError[], _warnings: ValidationWarning[]): void { // eslint-disable-line @typescript-eslint/no-unused-vars
    if (!tokenizer.name || typeof tokenizer.name !== 'string') {
      errors.push({
        field: 'tokenizer.name',
        message: 'Tokenizer name is required',
        severity: 'error'
      });
    }
  }

  private validateTraining(training: BaseTrainingConfig, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!training.method) {
      errors.push({
        field: 'training.method',
        message: 'Training method is required',
        severity: 'error'
      });
    }

    if (typeof training.batch_size !== 'number' || training.batch_size < 1) {
      errors.push({
        field: 'training.batch_size',
        message: 'Batch size must be at least 1',
        severity: 'error'
      });
    }

    if (typeof training.learning_rate !== 'number' || training.learning_rate <= 0) {
      errors.push({
        field: 'training.learning_rate',
        message: 'Learning rate must be greater than 0',
        severity: 'error'
      });
    }

    if (training.learning_rate > 1e-3) {
      warnings.push({
        field: 'training.learning_rate',
        message: 'High learning rate (>1e-3) may cause unstable training',
        severity: 'warning'
      });
    }

    if (training.use_lora && !training.lora_r) {
      errors.push({
        field: 'training.lora_r',
        message: 'LoRA rank (r) required when use_lora is true',
        severity: 'error'
      });
    }

    if (training.num_epochs < 1) {
      errors.push({
        field: 'training.num_epochs',
        message: 'Number of epochs must be at least 1',
        severity: 'error'
      });
    }
  }

  private validateData(data: DataConfig, errors: ValidationError[], _warnings: ValidationWarning[]): void { // eslint-disable-line @typescript-eslint/no-unused-vars
    if (!data.strategy) {
      errors.push({
        field: 'data.strategy',
        message: 'Data strategy is required',
        severity: 'error'
      });
    }

    // max_samples is optional - undefined or 0 means use full dataset
    // Only validate if it's explicitly set to a positive number
    if (data.max_samples !== undefined && data.max_samples !== null && data.max_samples !== 0) {
      if (typeof data.max_samples !== 'number' || data.max_samples < 1) {
        errors.push({
          field: 'data.max_samples',
          message: 'Max samples must be a positive number when specified (or 0 for full dataset)',
          severity: 'error'
        });
      }
    }

    if (typeof data.train_split !== 'number' || data.train_split < 0 || data.train_split > 1) {
      errors.push({
        field: 'data.train_split',
        message: 'Train split must be between 0 and 1',
        severity: 'error'
      });
    }
  }
}

export const configValidator = new TrainingConfigValidator();

console.log('[ConfigValidator] Validator loaded');
