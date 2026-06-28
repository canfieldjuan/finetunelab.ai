import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { STATUS } from '@/lib/constants';

const authGetUser = vi.fn();
const from = vi.fn();
const createClient = vi.fn(() => ({
  auth: {
    getUser: authGetUser,
  },
  from,
}));
const execSync = vi.fn();
const swapServer = vi.fn();
const getServerStatus = vi.fn();
const stopServer = vi.fn();
const getSecret = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient,
}));

vi.mock('child_process', () => ({
  execSync,
}));

vi.mock('@/lib/services/server-swap', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/server-swap')>(
    '@/lib/services/server-swap'
  );

  return {
    ...actual,
    swapServer,
  };
});

vi.mock('@/lib/services/inference-server-manager', () => ({
  inferenceServerManager: {
    getServerStatus,
    stopServer,
    startVLLM: vi.fn(),
    startOllama: vi.fn(),
  },
  sanitizeOllamaModelName: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
}));

vi.mock('@/lib/services/gpu-memory', () => ({
  waitForGpuMemoryRelease: vi.fn(),
}));

vi.mock('@/lib/cache/redis-cache', () => ({
  cacheDeletePattern: vi.fn(),
  generateCacheKey: vi.fn((prefix: string, userId: string) => `${prefix}:${userId}`),
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseAdmin: null,
}));

vi.mock('@/lib/secrets/secrets-manager.service', () => ({
  secretsManager: {
    getSecret,
  },
}));

vi.mock('@/lib/models/encryption', () => ({
  decrypt: vi.fn((value: string) => value),
}));

vi.mock('@/lib/inference/runpod-serverless-service', () => ({
  runpodServerlessService: {
    deployVLLMPod: vi.fn(),
    createEndpoint: vi.fn(),
  },
}));

vi.mock('@/lib/inference/fireworks-deployment-service', () => ({
  fireworksDeploymentService: {
    deployModel: vi.fn(),
    getDeploymentStatus: vi.fn(),
  },
}));

function makeRequest(body: unknown): NextRequest {
  return {
    headers: new Headers({
      authorization: 'Bearer test-token',
      'content-type': 'application/json',
    }),
    json: async () => body,
  } as unknown as NextRequest;
}

function llmModelsQuery() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(async () => ({ data: null, error: null })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: 'model-1' }, error: null })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { id: 'model-1' }, error: null })),
        })),
      })),
    })),
  };
}

describe('POST /api/training/deploy', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    authGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@example.com' } },
      error: null,
    });
    getServerStatus.mockResolvedValue({ status: STATUS.RUNNING });
    getSecret.mockResolvedValue(null);
    from.mockImplementation((table: string) => {
      if (table === 'llm_models') {
        return llmModelsQuery();
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('routes local vLLM deployments through swapServer instead of direct stop/start', async () => {
    swapServer.mockResolvedValue({
      ok: true,
      kind: 'started',
      serverInfo: {
        serverId: 'server-1',
        port: 8000,
        baseUrl: 'http://127.0.0.1:8000/v1',
        status: STATUS.STARTING,
      },
      eviction: {
        scope: 'user',
        stoppedServers: [
          {
            id: 'old-1',
            user_id: 'user-1',
            server_type: STATUS.OLLAMA,
            status: STATUS.RUNNING,
            model_name: 'old',
            port: 11434,
          },
        ],
        failures: [],
        affectedUserIds: ['user-1'],
      },
      gpu: { supported: true, released: true, usedMiB: 0, thresholdMiB: 512, attempts: 1 },
    });

    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      server_type: STATUS.VLLM,
      name: 'Local Qwen',
      config: {
        model_path: '/models/qwen',
        gpu_memory_utilization: 0.72,
        max_model_len: 4096,
        tensor_parallel_size: 1,
        dtype: 'auto',
        trust_remote_code: true,
      },
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.server_id).toBe('server-1');
    expect(payload.evicted_servers).toEqual([
      expect.objectContaining({ id: 'old-1', server_type: STATUS.OLLAMA }),
    ]);
    expect(execSync).toHaveBeenCalled();
    expect(stopServer).not.toHaveBeenCalled();
    expect(swapServer).toHaveBeenCalledWith(
      expect.objectContaining({
        targetServer: expect.objectContaining({
          server_type: STATUS.VLLM,
          model_path: '/models/qwen',
          model_name: 'Local Qwen',
          config_json: expect.objectContaining({
            gpu_memory_utilization: 0.72,
            max_model_len: 4096,
            trust_remote_code: true,
          }),
        }),
        scope: 'user',
      })
    );
  });

  it('does not invoke local swap orchestration for RunPod credential failures', async () => {
    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      server_type: STATUS.RUNPOD,
      name: 'RunPod model',
      config: {
        model_path: 'org/model',
      },
    }));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toContain('RunPod API key not configured');
    expect(swapServer).not.toHaveBeenCalled();
    expect(stopServer).not.toHaveBeenCalled();
  });
});
