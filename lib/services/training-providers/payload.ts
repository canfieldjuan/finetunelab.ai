// Training submission payload builder (shared)
// Centralizes payload creation for local/remote providers

import type { TrainingConfig } from '@/lib/training/training-config.types';
import { createSubmissionPayload } from '@/lib/training/config-builder';

export interface SubmissionOptions {
  config: TrainingConfig;
  datasetPath: string;
  executionId: string;
  name?: string;
  datasetContent?: unknown[];
}

export function buildTrainingSubmissionPayload(opts: SubmissionOptions) {
  console.log('[ProviderPayload] Building submission payload');
  const payload = createSubmissionPayload({
    config: opts.config,
    datasetPath: opts.datasetPath,
    executionId: opts.executionId,
    name: opts.name,
    datasetContent: opts.datasetContent,
  });
  console.log('[ProviderPayload] Payload ready');
  return payload;
}

