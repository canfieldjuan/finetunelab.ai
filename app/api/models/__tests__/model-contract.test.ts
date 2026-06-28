import { beforeEach, describe, expect, it, vi } from 'vitest';

const authGetUser = vi.fn();
const mockSupabase = {
  auth: {
    getUser: authGetUser,
  },
};

const createClient = vi.fn(() => mockSupabase);
const createModel = vi.fn();
const getModel = vi.fn();
const updateModel = vi.fn();
const cacheDeletePattern = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient,
}));

vi.mock('@/lib/models/model-manager.service', () => ({
  modelManager: {
    createModel,
    getModel,
    updateModel,
  },
}));

vi.mock('@/lib/cache/redis-cache', () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDeletePattern,
  generateCacheKey: vi.fn((prefix: string, id: string) => `${prefix}:${id}`),
}));

const createRequest = (body: Record<string, unknown>) =>
  new Request('http://localhost/api/models', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token',
    },
    body: JSON.stringify(body),
  });

describe('model API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
  });

  it('passes served_model_name and is_default through model creation', async () => {
    createModel.mockResolvedValue({
      id: 'model-1',
      name: 'Local Qwen',
      provider: 'vllm',
      enabled: true,
      served_model_name: 'qwen-chat',
      is_default: true,
    });

    const { POST } = await import('../route');

    const response = await POST(createRequest({
      name: 'Local Qwen',
      provider: 'vllm',
      base_url: 'http://127.0.0.1:8002/v1',
      model_id: '/models/qwen',
      served_model_name: 'qwen-chat',
      auth_type: 'none',
      is_default: true,
    }) as never);

    expect(response.status).toBe(201);
    expect(createModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model_id: '/models/qwen',
        served_model_name: 'qwen-chat',
        is_default: true,
      }),
      'user-1',
      mockSupabase
    );
    expect(cacheDeletePattern).toHaveBeenCalledWith('api:models:user-1');
  });

  it('passes served_model_name and is_default through model updates', async () => {
    getModel.mockResolvedValue({
      id: 'model-1',
      user_id: 'user-1',
      name: 'Local Qwen',
      provider: 'vllm',
      enabled: true,
      is_global: false,
    });
    updateModel.mockResolvedValue({
      id: 'model-1',
      name: 'Local Qwen',
      provider: 'vllm',
      enabled: true,
      served_model_name: 'qwen-chat-v2',
      is_default: true,
    });

    const { PATCH } = await import('../[id]/route');

    const response = await PATCH(
      createRequest({
        served_model_name: 'qwen-chat-v2',
        is_default: true,
      }) as never,
      { params: Promise.resolve({ id: 'model-1' }) }
    );

    expect(response.status).toBe(200);
    expect(updateModel).toHaveBeenCalledWith(
      'model-1',
      expect.objectContaining({
        served_model_name: 'qwen-chat-v2',
        is_default: true,
      }),
      mockSupabase
    );
    expect(cacheDeletePattern).toHaveBeenCalledWith('api:models:user-1');
  });
});
