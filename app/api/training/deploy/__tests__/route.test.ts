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
const supabaseState = vi.hoisted(() => ({
  supabaseAdmin: null as unknown,
}));

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
  get supabaseAdmin() {
    return supabaseState.supabaseAdmin;
  },
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
    supabaseState.supabaseAdmin = null;
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

  it('treats already-running local swap results as successful deploys', async () => {
    swapServer.mockResolvedValue({
      ok: true,
      kind: 'already_running',
      targetServer: {
        id: 'running-1',
        user_id: 'user-1',
        server_type: STATUS.VLLM,
        status: STATUS.RUNNING,
        base_url: 'http://127.0.0.1:8001/v1',
        model_path: '/models/qwen',
        model_name: 'Local Qwen',
        port: 8001,
        process_id: 12345,
        training_job_id: null,
        config_json: {},
      },
      eviction: {
        scope: 'user',
        stoppedServers: [],
        failures: [],
        affectedUserIds: ['user-1'],
      },
    });

    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      server_type: STATUS.VLLM,
      name: 'Local Qwen',
      config: {
        model_path: '/models/qwen',
      },
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.server_id).toBe('running-1');
    expect(payload.base_url).toBe('http://127.0.0.1:8001/v1');
    expect(payload.port).toBe(8001);
  });

  it('maps GPU-not-released swap failures to 409 responses', async () => {
    swapServer.mockResolvedValue({
      ok: false,
      kind: 'gpu_not_released',
      statusCode: 409,
      error: 'GPU memory is still in use after eviction',
      eviction: {
        scope: 'user',
        stoppedServers: [{ id: 'old-1', user_id: 'user-1', server_type: STATUS.VLLM, status: STATUS.RUNNING, model_name: 'old', port: 8000 }],
        failures: [],
        affectedUserIds: ['user-1'],
      },
      gpu: { supported: true, released: false, usedMiB: 2048, thresholdMiB: 512, attempts: 10 },
    });

    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      server_type: STATUS.VLLM,
      name: 'Local Qwen',
      config: {
        model_path: '/models/qwen',
      },
    }));

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error).toBe('GPU memory is still in use after eviction');
    expect(payload.gpu).toEqual(expect.objectContaining({ released: false }));
    expect(payload.evicted_servers).toEqual([
      expect.objectContaining({ id: 'old-1' }),
    ]);
  });

  it('maps start-failed swap failures to partial-failure responses', async () => {
    swapServer.mockResolvedValue({
      ok: false,
      kind: 'start_failed',
      statusCode: 500,
      error: 'Failed to start target server after evicting existing local servers',
      details: 'vLLM failed',
      eviction: {
        scope: 'user',
        stoppedServers: [{ id: 'old-1', user_id: 'user-1', server_type: STATUS.OLLAMA, status: STATUS.RUNNING, model_name: 'old', port: 11434 }],
        failures: [],
        affectedUserIds: ['user-1'],
      },
      gpu: { supported: true, released: true, usedMiB: 0, thresholdMiB: 512, attempts: 1 },
      restartAttempt: { attempted: false, reason: 'No previously running local server was evicted.' },
      gpuEmpty: true,
    });

    const { POST } = await import('../route');

    const response = await POST(makeRequest({
      server_type: STATUS.VLLM,
      name: 'Local Qwen',
      config: {
        model_path: '/models/qwen',
      },
    }));

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.partial_failure).toBe(true);
    expect(payload.details).toBe('vLLM failed');
    expect(payload.gpu_empty).toBe(true);
    expect(payload.restart_attempt).toEqual(expect.objectContaining({ attempted: false }));
  });

  it('uses global eviction scope when the admin client is configured', async () => {
    supabaseState.supabaseAdmin = { from: vi.fn() };
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
        scope: 'global',
        stoppedServers: [],
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
      },
    }));

    expect(response.status).toBe(200);
    expect(swapServer).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'global',
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
