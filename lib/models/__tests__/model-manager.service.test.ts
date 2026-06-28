import { beforeEach, describe, expect, it, vi } from 'vitest';

const insert = vi.fn();
const update = vi.fn();
const eq = vi.fn();
const selectAfterInsert = vi.fn();
const selectAfterUpdate = vi.fn();
const singleAfterInsert = vi.fn();
const singleAfterUpdate = vi.fn();

const mockClient = {
  from: vi.fn(),
};

vi.mock('@/lib/supabaseClient', () => ({
  supabase: mockClient,
  supabaseAdmin: mockClient,
}));

function makeInsertChain() {
  singleAfterInsert.mockResolvedValue({
    data: {
      id: 'model-1',
      name: 'Local Qwen',
      provider: 'vllm',
    },
    error: null,
  });
  selectAfterInsert.mockReturnValue({ single: singleAfterInsert });
  insert.mockReturnValue({ select: selectAfterInsert });
  return { insert };
}

function makeUpdateChain() {
  singleAfterUpdate.mockResolvedValue({
    data: {
      id: 'model-1',
      name: 'Local Qwen',
      provider: 'vllm',
    },
    error: null,
  });
  selectAfterUpdate.mockReturnValue({ single: singleAfterUpdate });
  eq.mockReturnValue({ select: selectAfterUpdate });
  update.mockReturnValue({ eq });
  return { update };
}

describe('modelManager model contract persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists served_model_name and is_default on create', async () => {
    mockClient.from.mockReturnValue(makeInsertChain());
    const { modelManager } = await import('../model-manager.service');

    await modelManager.createModel(
      {
        name: 'Local Qwen',
        provider: 'vllm',
        base_url: 'http://127.0.0.1:8002/v1',
        model_id: '/models/qwen',
        served_model_name: 'qwen-chat',
        auth_type: 'none',
        is_default: true,
      },
      'user-1',
      mockClient as never
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        model_id: '/models/qwen',
        served_model_name: 'qwen-chat',
        is_default: true,
      })
    );
  });

  it('normalizes empty served_model_name to null on update', async () => {
    mockClient.from.mockReturnValue(makeUpdateChain());
    const { modelManager } = await import('../model-manager.service');

    await modelManager.updateModel(
      'model-1',
      {
        served_model_name: '',
        is_default: false,
      },
      mockClient as never
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        served_model_name: null,
        is_default: false,
      })
    );
  });
});
