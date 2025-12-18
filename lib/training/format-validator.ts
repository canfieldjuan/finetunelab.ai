// Dataset Format Validator
// Validates dataset format compatibility with training methods
// Date: 2025-10-16

import type { DatasetFormat } from './dataset.types';

export type TrainingMethod = 'sft' | 'dpo' | 'rlhf' | 'orpo' | 'cpt';

export interface MethodCompatibility {
  compatible: boolean;
  reason?: string;
}

const FORMAT_COMPATIBILITY: Record<TrainingMethod, DatasetFormat[]> = {
  sft: ['chatml', 'sharegpt', 'jsonl', 'alpaca', 'openorca', 'unnatural'],
  dpo: ['dpo'],
  rlhf: ['rlhf'],
  orpo: ['dpo'],  // ORPO uses same format as DPO (chosen/rejected pairs)
  cpt: ['raw_text'],  // CPT uses raw text for continued pre-training
};

export function isFormatCompatible(format: DatasetFormat, method: TrainingMethod): boolean {
  console.log('[FormatValidator] Checking compatibility:', format, 'with', method);
  return FORMAT_COMPATIBILITY[method].includes(format);
}

export function getCompatibleMethods(format: DatasetFormat): TrainingMethod[] {
  console.log('[FormatValidator] Getting compatible methods for format:', format);
  const methods: TrainingMethod[] = [];

  for (const [method, formats] of Object.entries(FORMAT_COMPATIBILITY)) {
    if (formats.includes(format)) {
      methods.push(method as TrainingMethod);
    }
  }

  console.log('[FormatValidator] Compatible methods:', methods);
  return methods;
}

export function getIncompatibilityReason(format: DatasetFormat, method: TrainingMethod): string {
  if (isFormatCompatible(format, method)) {
    return '';
  }

  const formatName = format.toUpperCase();
  const methodName = method.toUpperCase();
  const requiredFormats = FORMAT_COMPATIBILITY[method].map(f => f.toUpperCase()).join(', ');

  return `${methodName} requires ${requiredFormats} format. Current dataset is ${formatName} format.`;
}

console.log('[FormatValidator] Format validator loaded');
