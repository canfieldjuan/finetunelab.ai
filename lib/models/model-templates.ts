// Model Templates
// Pre-configured templates for popular LLM providers
// Date: 2025-10-14

import type { ModelTemplate } from './llm-model.types';

// ============================================================================
// OPENAI TEMPLATES
// ============================================================================

export const OPENAI_TEMPLATES: ModelTemplate[] = [
  {
    id: 'openai-gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and cost-effective model for most tasks',
    base_url: 'https://api.openai.com/v1',
    model_id: 'gpt-4o-mini',
    auth_type: 'bearer',
    supports_streaming: true,
    supports_functions: true,
    supports_vision: true,
    context_length: 128000,
    max_output_tokens: 16384,
    price_per_input_token: 0.00000015,
    price_per_output_token: 0.0000006,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'sk-proj-...',
  },
  {
    id: 'openai-gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'Most capable model for complex reasoning',
    base_url: 'https://api.openai.com/v1',
    model_id: 'gpt-4-turbo-preview',
    auth_type: 'bearer',
    supports_streaming: true,
    supports_functions: true,
    supports_vision: true,
    context_length: 128000,
    max_output_tokens: 4096,
    price_per_input_token: 0.00001,
    price_per_output_token: 0.00003,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'sk-proj-...',
  },
  {
    id: 'openai-gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    description: 'Fast and affordable model for simple tasks',
    base_url: 'https://api.openai.com/v1',
    model_id: 'gpt-3.5-turbo',
    auth_type: 'bearer',
    supports_streaming: true,
    supports_functions: true,
    supports_vision: false,
    context_length: 16385,
    max_output_tokens: 4096,
    price_per_input_token: 0.0000005,
    price_per_output_token: 0.0000015,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'sk-proj-...',
  },
  {
    id: 'openai-gpt-5-chat',
    name: 'GPT-5 Chat',
    provider: 'openai',
    description: 'OpenAI\'s latest generation model for conversational AI',
    base_url: 'https://api.openai.com/v1',
    model_id: 'gpt-5-chat',
    auth_type: 'bearer',
    supports_streaming: true,
    supports_functions: true,
    supports_vision: true,
    context_length: 256000,
    max_output_tokens: 32768,
    price_per_input_token: 0.000015,
    price_per_output_token: 0.000045,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'sk-proj-...',
  },
  {
    id: 'openai-gpt-5-pro',
    name: 'GPT-5 Pro',
    provider: 'openai',
    description: 'Most advanced GPT-5 model for complex reasoning and multi-step tasks',
    base_url: 'https://api.openai.com/v1',
    model_id: 'gpt-5-pro',
    auth_type: 'bearer',
    supports_streaming: true,
    supports_functions: true,
    supports_vision: true,
    context_length: 256000,
    max_output_tokens: 65536,
    price_per_input_token: 0.00003,
    price_per_output_token: 0.00009,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'sk-proj-...',
  },
];

// ============================================================================
// ANTHROPIC TEMPLATES
// ============================================================================

export const ANTHROPIC_TEMPLATES: ModelTemplate[] = [
  {
    id: 'anthropic-claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Anthropic\'s most intelligent model',
    base_url: 'https://api.anthropic.com/v1',
    model_id: 'claude-3-5-sonnet-20241022',
    auth_type: 'api_key',
    supports_streaming: true,
    supports_functions: true,
    supports_vision: true,
    context_length: 200000,
    max_output_tokens: 8192,
    price_per_input_token: 0.000003,
    price_per_output_token: 0.000015,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'sk-ant-...',
  },
  {
    id: 'anthropic-claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    description: 'Most powerful Claude model for highly complex tasks',
    base_url: 'https://api.anthropic.com/v1',
    model_id: 'claude-3-opus-20240229',
    auth_type: 'api_key',
    supports_streaming: true,
    supports_functions: true,
    supports_vision: true,
    context_length: 200000,
    max_output_tokens: 4096,
    price_per_input_token: 0.000015,
    price_per_output_token: 0.000075,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'sk-ant-...',
  },
  {
    id: 'anthropic-claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    description: 'Fast and cost-effective Anthropic model',
    base_url: 'https://api.anthropic.com/v1',
    model_id: 'claude-3-haiku-20240307',
    auth_type: 'api_key',
    supports_streaming: true,
    supports_functions: true,
    supports_vision: false,
    context_length: 200000,
    max_output_tokens: 4096,
    price_per_input_token: 0.00000025,
    price_per_output_token: 0.00000125,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'sk-ant-...',
  },
  {
    id: 'anthropic-claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    description: 'Next-generation Claude model with enhanced reasoning and vision',
    base_url: 'https://api.anthropic.com/v1',
    model_id: 'claude-sonnet-4.5',
    auth_type: 'api_key',
    supports_streaming: true,
    supports_functions: true,
    supports_vision: true,
    context_length: 300000,
    max_output_tokens: 16384,
    price_per_input_token: 0.000005,
    price_per_output_token: 0.000025,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'sk-ant-...',
  },
  {
    id: 'anthropic-claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    description: 'Ultra-fast Claude 4.5 model optimized for speed and cost',
    base_url: 'https://api.anthropic.com/v1',
    model_id: 'claude-haiku-4.5',
    auth_type: 'api_key',
    supports_streaming: true,
    supports_functions: true,
    supports_vision: true,
    context_length: 300000,
    max_output_tokens: 8192,
    price_per_input_token: 0.0000008,
    price_per_output_token: 0.000004,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'sk-ant-...',
  },
];

// ============================================================================
// HUGGINGFACE TEMPLATES
// ============================================================================

export const HUGGINGFACE_TEMPLATES: ModelTemplate[] = [
  {
    id: 'huggingface-custom-import',
    name: 'Import Custom Model',
    provider: 'huggingface',
    description: 'Import your trained model from HuggingFace Hub (e.g., Qwen2.5-0.5B for testing)',
    base_url: 'https://router.huggingface.co/v1',
    model_id: 'Qwen/Qwen2.5-0.5B', // Example: 0.5B params, good for testing
    auth_type: 'bearer',
    supports_streaming: false, // HF Inference API limitation
    supports_functions: true, // Trained models often support function calling
    supports_vision: false,
    context_length: 32768, // Qwen2.5 supports long context
    max_output_tokens: 2048,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'Get token from https://huggingface.co/settings/tokens',
  },
  {
    id: 'huggingface-mistral-7b',
    name: 'Mistral 7B Instruct',
    provider: 'huggingface',
    description: 'Open-source 7B parameter model from Mistral AI',
    base_url: 'https://router.huggingface.co/v1',
    model_id: 'mistralai/Mistral-7B-Instruct-v0.2',
    auth_type: 'bearer',
    supports_streaming: false,
    supports_functions: false,
    supports_vision: false,
    context_length: 32768,
    max_output_tokens: 2048,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'hf_...',
  },
  {
    id: 'huggingface-llama-3.1-8b',
    name: 'Meta Llama 3.1 8B',
    provider: 'huggingface',
    description: 'Meta\'s latest open-source language model',
    base_url: 'https://router.huggingface.co/v1',
    model_id: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    auth_type: 'bearer',
    supports_streaming: false,
    supports_functions: false,
    supports_vision: false,
    context_length: 131072,
    max_output_tokens: 4096,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'hf_...',
  },
  {
    id: 'huggingface-zephyr-7b',
    name: 'Zephyr 7B Beta',
    provider: 'huggingface',
    description: 'Fine-tuned Mistral 7B with helpful assistant behavior',
    base_url: 'https://router.huggingface.co/v1',
    model_id: 'HuggingFaceH4/zephyr-7b-beta',
    auth_type: 'bearer',
    supports_streaming: false,
    supports_functions: false,
    supports_vision: false,
    context_length: 32768,
    max_output_tokens: 2048,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'hf_...',
  },
  {
    id: 'huggingface-gpt2',
    name: 'GPT-2',
    provider: 'huggingface',
    description: 'OpenAI\'s GPT-2 model (free tier available)',
    base_url: 'https://router.huggingface.co/v1',
    model_id: 'gpt2',
    auth_type: 'bearer',
    supports_streaming: false,
    supports_functions: false,
    supports_vision: false,
    context_length: 1024,
    max_output_tokens: 50, // Limited for free tier
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'Optional - free tier available',
  },
];

// ============================================================================
// OLLAMA TEMPLATES (local models)
// ============================================================================

export const OLLAMA_TEMPLATES: ModelTemplate[] = [
  {
    id: 'ollama-llama3.1-8b',
    name: 'Llama 3.1 8B (Ollama)',
    provider: 'ollama',
    description: 'Run Llama 3.1 8B locally with Ollama',
    base_url: 'http://localhost:11434',
    model_id: 'llama3.1:8b',
    auth_type: 'none',
    supports_streaming: true,
    supports_functions: false,
    supports_vision: false,
    context_length: 131072,
    max_output_tokens: 4096,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'No API key required',
  },
  {
    id: 'ollama-mistral-7b',
    name: 'Mistral 7B (Ollama)',
    provider: 'ollama',
    description: 'Run Mistral 7B locally with Ollama',
    base_url: 'http://localhost:11434',
    model_id: 'mistral:7b',
    auth_type: 'none',
    supports_streaming: true,
    supports_functions: false,
    supports_vision: false,
    context_length: 32768,
    max_output_tokens: 2048,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'No API key required',
  },
  {
    id: 'ollama-phi3-mini',
    name: 'Phi-3 Mini (Ollama)',
    provider: 'ollama',
    description: 'Microsoft\'s compact 3.8B parameter model',
    base_url: 'http://localhost:11434',
    model_id: 'phi3:mini',
    auth_type: 'none',
    supports_streaming: true,
    supports_functions: false,
    supports_vision: false,
    context_length: 131072,
    max_output_tokens: 4096,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'No API key required',
  },
];

// ============================================================================
// VLLM / CUSTOM ENDPOINT TEMPLATES
// ============================================================================

export const VLLM_TEMPLATES: ModelTemplate[] = [
  {
    id: 'vllm-custom',
    name: 'Custom vLLM Endpoint',
    provider: 'vllm',
    description: 'Self-hosted model using vLLM (OpenAI-compatible API)',
    base_url: 'http://localhost:8000/v1',
    model_id: 'custom-model',
    auth_type: 'bearer',
    supports_streaming: true,
    supports_functions: true,
    supports_vision: false,
    context_length: 4096,
    max_output_tokens: 2000,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'Optional API key',
  },
  {
    id: 'vllm-mistral-7b',
    name: 'Mistral 7B (vLLM)',
    provider: 'vllm',
    description: 'Self-hosted Mistral 7B using vLLM',
    base_url: 'http://localhost:8000/v1',
    model_id: 'mistralai/Mistral-7B-Instruct-v0.2',
    auth_type: 'none',
    supports_streaming: true,
    supports_functions: false,
    supports_vision: false,
    context_length: 32768,
    max_output_tokens: 2048,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'No API key required',
  },
];

// ============================================================================
// AZURE OPENAI TEMPLATES
// ============================================================================

export const AZURE_TEMPLATES: ModelTemplate[] = [
  {
    id: 'azure-gpt-4o',
    name: 'GPT-4o (Azure)',
    provider: 'azure',
    description: 'Azure OpenAI GPT-4o deployment',
    base_url: 'https://YOUR-RESOURCE.openai.azure.com',
    model_id: 'your-deployment-name',
    auth_type: 'api_key',
    supports_streaming: true,
    supports_functions: true,
    supports_vision: true,
    context_length: 128000,
    max_output_tokens: 16384,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'Azure API key',
  },
  {
    id: 'azure-gpt-35-turbo',
    name: 'GPT-3.5 Turbo (Azure)',
    provider: 'azure',
    description: 'Azure OpenAI GPT-3.5 Turbo deployment',
    base_url: 'https://YOUR-RESOURCE.openai.azure.com',
    model_id: 'your-deployment-name',
    auth_type: 'api_key',
    supports_streaming: true,
    supports_functions: true,
    supports_vision: false,
    context_length: 16385,
    max_output_tokens: 4096,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'Azure API key',
  },
];

// ============================================================================
// AGGREGATED EXPORTS
// ============================================================================

export const ALL_TEMPLATES: ModelTemplate[] = [
  ...OPENAI_TEMPLATES,
  ...ANTHROPIC_TEMPLATES,
  ...HUGGINGFACE_TEMPLATES,
  ...OLLAMA_TEMPLATES,
  ...VLLM_TEMPLATES,
  ...AZURE_TEMPLATES,
];

export const TEMPLATES_BY_PROVIDER: Record<string, ModelTemplate[]> = {
  openai: OPENAI_TEMPLATES,
  anthropic: ANTHROPIC_TEMPLATES,
  huggingface: HUGGINGFACE_TEMPLATES,
  ollama: OLLAMA_TEMPLATES,
  vllm: VLLM_TEMPLATES,
  azure: AZURE_TEMPLATES,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getTemplateById(id: string): ModelTemplate | undefined {
  return ALL_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByProvider(
  provider: string
): ModelTemplate[] {
  return TEMPLATES_BY_PROVIDER[provider] || [];
}

export function searchTemplates(query: string): ModelTemplate[] {
  const lowerQuery = query.toLowerCase();
  return ALL_TEMPLATES.filter(
    t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.provider.toLowerCase().includes(lowerQuery)
  );
}

console.log('[ModelTemplates] Loaded', ALL_TEMPLATES.length, 'model templates');
