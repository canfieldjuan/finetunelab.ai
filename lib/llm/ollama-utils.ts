import type { ModelConfig } from '@/lib/models/llm-model.types';

export function toOllamaNativeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '').replace(/\/v1$/i, '');
}

export function resolveOllamaRequestModel(
  config: Pick<ModelConfig, 'model_id' | 'served_model_name'>
): string {
  return config.served_model_name?.trim() || config.model_id;
}
