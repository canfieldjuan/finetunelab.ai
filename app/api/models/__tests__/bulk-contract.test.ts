import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateModelDTO, LLMModel } from '@/lib/models/llm-model.types';

const authGetUser = vi.fn();
const mockSupabase = {
  auth: {
    getUser: authGetUser,
  },
};

const createClient = vi.fn(() => mockSupabase);
const createModel = vi.fn();
const cacheDeletePattern = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient,
}));

vi.mock('@/lib/models/model-manager.service', () => ({
  modelManager: {
    createModel,
  },
}));

vi.mock('@/lib/cache/redis-cache', () => ({
  cacheDeletePattern,
  generateCacheKey: vi.fn((prefix: string, id: string) => `${prefix}:${id}`),
}));

const createRequest = (body: Record<string, unknown>) =>
  new Request('http://localhost/api/models/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token',
    },
    body: JSON.stringify(body),
  });

function modelFromDto(dto: CreateModelDTO, id: string): LLMModel {
  return {
    id,
    user_id: 'user-1',
    name: dto.name,
    description: dto.description ?? null,
    provider: dto.provider,
    base_url: dto.base_url,
    model_id: dto.model_id,
    served_model_name: dto.served_model_name ?? null,
    auth_type: dto.auth_type,
    api_key_encrypted: null,
    auth_headers: dto.auth_headers ?? {},
    supports_streaming: dto.supports_streaming ?? true,
    supports_functions: dto.supports_functions ?? false,
    supports_vision: dto.supports_vision ?? false,
    context_length: dto.context_length ?? 4096,
    max_output_tokens: dto.max_output_tokens ?? 2000,
    price_per_input_token: null,
    price_per_output_token: null,
    default_temperature: dto.default_temperature ?? 0.7,
    default_top_p: dto.default_top_p ?? 1,
    enabled: dto.enabled ?? true,
    is_global: false,
    is_default: dto.is_default ?? false,
    training_method: null,
    base_model: null,
    training_dataset: null,
    training_date: null,
    lora_config: null,
    evaluation_metrics: null,
    metadata: null,
    created_at: '2026-06-28T00:00:00.000Z',
    updated_at: '2026-06-28T00:00:00.000Z',
    last_used_at: null,
  };
}

describe('POST /api/models/bulk contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
  });

  it('creates discovered vLLM models without storing an API key', async () => {
    createModel.mockImplementation(async (dto: CreateModelDTO) => modelFromDto(dto, `model-${createModel.mock.calls.length}`));

    const { POST } = await import('../bulk/route');

    const response = await POST(createRequest({
      provider: 'vllm',
      base_url: 'https://example-vllm.test/v1',
      auth_type: 'none',
      models: [
        { model_id: 'qwen-chat', max_model_len: 32768 },
        { model_id: 'llama-chat' },
        { model_id: 'mistral-chat', name: 'Mistral Chat' },
      ],
    }) as never);

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.counts).toEqual({ created: 3, skipped: 0, failed: 0 });
    expect(createModel).toHaveBeenCalledTimes(3);
    expect(createModel).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: 'qwen-chat',
        model_id: 'qwen-chat',
        served_model_name: 'qwen-chat',
        context_length: 32768,
        auth_type: 'none',
      }),
      'user-1',
      mockSupabase
    );

    for (const [dto] of createModel.mock.calls as Array<[CreateModelDTO]>) {
      expect(dto).not.toHaveProperty('api_key');
      expect(dto.is_default).toBe(false);
    }
    expect(cacheDeletePattern).toHaveBeenCalledTimes(1);
    expect(cacheDeletePattern).toHaveBeenCalledWith('api:models:user-1');
  });

  it('creates curated provider models with model-specific capabilities', async () => {
    createModel.mockImplementation(async (dto: CreateModelDTO) => modelFromDto(dto, `model-${createModel.mock.calls.length}`));

    const { POST } = await import('../bulk/route');

    const response = await POST(createRequest({
      provider: 'anthropic',
      base_url: 'https://api.anthropic.com/v1',
      auth_type: 'api_key',
      models: [
        {
          model_id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          context_length: 200000,
          max_output_tokens: 8192,
          supports_streaming: true,
          supports_functions: true,
          supports_vision: true,
          price_per_input_token: 0.000003,
          price_per_output_token: 0.000015,
          default_temperature: 0.2,
          default_top_p: 0.9,
        },
      ],
    }) as never);

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.counts).toEqual({ created: 1, skipped: 0, failed: 0 });
    expect(createModel).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        model_id: 'claude-3-5-sonnet-20241022',
        auth_type: 'api_key',
        supports_streaming: true,
        supports_functions: true,
        supports_vision: true,
        context_length: 200000,
        max_output_tokens: 8192,
        price_per_input_token: 0.000003,
        price_per_output_token: 0.000015,
        default_temperature: 0.2,
        default_top_p: 0.9,
      }),
      'user-1',
      mockSupabase
    );
    expect(createModel.mock.calls[0][0]).not.toHaveProperty('api_key');
  });

  it('accepts curated HuggingFace models through bulk import', async () => {
    createModel.mockImplementation(async (dto: CreateModelDTO) => modelFromDto(dto, `model-${createModel.mock.calls.length}`));

    const { POST } = await import('../bulk/route');

    const response = await POST(createRequest({
      provider: 'huggingface',
      base_url: 'https://router.huggingface.co/v1',
      auth_type: 'bearer',
      models: [
        {
          model_id: 'mistralai/Mistral-7B-Instruct-v0.3',
          name: 'Mistral 7B Instruct',
          context_length: 32768,
          max_output_tokens: 2048,
          supports_streaming: false,
          supports_functions: false,
          supports_vision: false,
        },
      ],
    }) as never);

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.counts).toEqual({ created: 1, skipped: 0, failed: 0 });
    expect(createModel).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'huggingface',
        base_url: 'https://router.huggingface.co/v1',
        auth_type: 'bearer',
        model_id: 'mistralai/Mistral-7B-Instruct-v0.3',
        supports_streaming: false,
        supports_functions: false,
        supports_vision: false,
      }),
      'user-1',
      mockSupabase
    );
    expect(createModel.mock.calls[0][0]).not.toHaveProperty('api_key');
  });

  it('treats duplicate model names as skipped for idempotent re-import', async () => {
    createModel.mockRejectedValue(new Error('DUPLICATE_MODEL_NAME'));

    const { POST } = await import('../bulk/route');

    const response = await POST(createRequest({
      provider: 'openai',
      base_url: 'https://api.openai.com/v1',
      auth_type: 'bearer',
      models: [
        { model_id: 'gpt-4o-mini' },
        { model_id: 'gpt-4.1-mini' },
      ],
    }) as never);

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.created).toEqual([]);
    expect(payload.skipped).toEqual([
      { model_id: 'gpt-4o-mini', reason: 'already_exists' },
      { model_id: 'gpt-4.1-mini', reason: 'already_exists' },
    ]);
    expect(payload.failed).toEqual([]);
    expect(cacheDeletePattern).not.toHaveBeenCalled();
  });

  it('skips duplicate models inside the same request before creating rows', async () => {
    createModel.mockImplementation(async (dto: CreateModelDTO) => modelFromDto(dto, 'model-1'));

    const { POST } = await import('../bulk/route');

    const response = await POST(createRequest({
      provider: 'openai',
      base_url: 'https://api.openai.com/v1',
      auth_type: 'bearer',
      models: [
        { model_id: 'gpt-4o-mini' },
        { model_id: 'gpt-4o-mini' },
      ],
    }) as never);

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.counts).toEqual({ created: 1, skipped: 1, failed: 0 });
    expect(payload.skipped).toEqual([{ model_id: 'gpt-4o-mini', reason: 'duplicate_in_request' }]);
    expect(createModel).toHaveBeenCalledTimes(1);
  });

  it('rejects providers without bulk import support', async () => {
    const { POST } = await import('../bulk/route');

    const response = await POST(createRequest({
      provider: 'azure',
      base_url: 'https://example.openai.azure.com',
      auth_type: 'bearer',
      models: [{ model_id: 'gpt-4-deployment' }],
    }) as never);

    expect(response.status).toBe(400);
    const payload = await response.json();

    expect(payload.unsupported).toBe(true);
    expect(createModel).not.toHaveBeenCalled();
  });

  it('rejects unsupported auth types before creating rows', async () => {
    const { POST } = await import('../bulk/route');

    const response = await POST(createRequest({
      provider: 'openai',
      base_url: 'https://api.openai.com/v1',
      auth_type: 'basic',
      models: [{ model_id: 'gpt-4o-mini' }],
    }) as never);

    expect(response.status).toBe(400);
    const payload = await response.json();

    expect(payload.error).toBe('invalid_auth_type');
    expect(createModel).not.toHaveBeenCalled();
  });

  it('rejects requests over the per-request model limit', async () => {
    const { POST } = await import('../bulk/route');

    const response = await POST(createRequest({
      provider: 'openai',
      base_url: 'https://api.openai.com/v1',
      auth_type: 'bearer',
      models: Array.from({ length: 101 }, (_, index) => ({ model_id: `model-${index}` })),
    }) as never);

    expect(response.status).toBe(400);
    const payload = await response.json();

    expect(payload.error).toBe('too_many_models');
    expect(payload.max_models).toBe(100);
    expect(createModel).not.toHaveBeenCalled();
  });
});
