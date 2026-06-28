/**
 * Server Swap API Endpoint
 *
 * POST /api/servers/swap
 * Serializes local model swaps, evicts local GPU servers, waits for VRAM to
 * settle when nvidia-smi is available, then starts the requested server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inferenceServerManager, type ServerInfo } from '@/lib/services/inference-server-manager';
import { waitForGpuMemoryRelease, type GpuMemoryWaitResult } from '@/lib/services/gpu-memory';
import { cacheDeletePattern, generateCacheKey } from '@/lib/cache/redis-cache';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { STATUS } from '@/lib/constants';

export const runtime = 'nodejs';

const SERVER_CACHE_PREFIX = 'api:servers';
const LOCAL_SERVER_TYPES = [STATUS.VLLM, STATUS.OLLAMA, 'simple'];
const ACTIVE_SERVER_STATUSES = [STATUS.RUNNING, STATUS.STARTING];

type AuthenticatedUser = {
  id: string;
  email?: string;
};

type ServerConfigJson = {
  gpu_memory_utilization?: number;
  max_model_len?: number;
  tensor_parallel_size?: number;
  dtype?: 'auto' | 'half' | 'float16' | 'bfloat16' | 'float32';
  trust_remote_code?: boolean;
  context_length?: number;
  external?: boolean;
};

type LocalServerRow = {
  id: string;
  user_id: string | null;
  name?: string | null;
  server_type: string;
  status: string;
  model_path: string;
  model_name: string;
  port: number | null;
  process_id: number | null;
  training_job_id?: string | null;
  config_json?: ServerConfigJson | null;
};

type EvictionResult = {
  scope: 'global' | 'user';
  stoppedServers: Array<{
    id: string;
    user_id: string | null;
    server_type: string;
    status: string;
    model_name: string;
    port: number | null;
  }>;
  failures: Array<{
    id: string;
    error: string;
  }>;
  affectedUserIds: string[];
};

let swapQueue: Promise<void> = Promise.resolve();

async function runSerializedSwap<T>(operation: () => Promise<T>): Promise<T> {
  const previous = swapQueue;
  let release!: () => void;

  swapQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    return await operation();
  } finally {
    release();
  }
}

function jsonError(error: string, status: number, details?: Record<string, unknown>) {
  return NextResponse.json({ error, ...details }, { status });
}

function createAuthenticatedSupabase(authHeader: string): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

async function authenticate(req: NextRequest): Promise<{ supabase: SupabaseClient; user: AuthenticatedUser } | NextResponse> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[ServerSwap] No authorization header provided');
    return jsonError('Unauthorized - Authorization header required', 401);
  }

  const supabase = createAuthenticatedSupabase(authHeader);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('[ServerSwap] Authentication failed:', authError);
    return jsonError('Unauthorized - please login', 401);
  }

  return {
    supabase,
    user: {
      id: user.id,
      email: user.email,
    },
  };
}

async function fetchTargetServer(
  supabase: SupabaseClient,
  serverId: string,
  userId: string
): Promise<LocalServerRow | NextResponse> {
  const { data: server, error } = await supabase
    .from('local_inference_servers')
    .select('*')
    .eq('id', serverId)
    .eq('user_id', userId)
    .single();

  if (error || !server) {
    console.error('[ServerSwap] Server not found:', error);
    return jsonError('Server not found or access denied', 404);
  }

  return server as LocalServerRow;
}

function isProcessAlive(pid: number | null | undefined): boolean {
  if (!pid) return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isAlreadyRunning(server: LocalServerRow): boolean {
  if (server.status !== STATUS.RUNNING) return false;
  if (server.config_json?.external) return true;
  return isProcessAlive(server.process_id);
}

async function evictLocalServersForSwap(
  supabase: SupabaseClient,
  userId: string,
  targetServer: LocalServerRow,
  keepTargetRunning: boolean
): Promise<EvictionResult> {
  const evictionClient = supabaseAdmin ?? supabase;
  const canEvictGlobally = Boolean(supabaseAdmin);

  let query = evictionClient
    .from('local_inference_servers')
    .select('id, user_id, server_type, status, model_name, port')
    .in('server_type', LOCAL_SERVER_TYPES)
    .in('status', ACTIVE_SERVER_STATUSES);

  if (!canEvictGlobally) {
    query = query.eq('user_id', userId);
  }

  const { data: servers, error } = await query;

  if (error) {
    console.error('[ServerSwap] Failed to list local servers for eviction:', error);
    return {
      scope: canEvictGlobally ? 'global' : 'user',
      stoppedServers: [],
      failures: [{ id: 'local_inference_servers', error: error.message }],
      affectedUserIds: [userId],
    };
  }

  const stoppedServers: EvictionResult['stoppedServers'] = [];
  const failures: EvictionResult['failures'] = [];
  const affectedUserIds = new Set<string>([userId]);

  for (const server of (servers ?? []) as LocalServerRow[]) {
    if (keepTargetRunning && server.id === targetServer.id) {
      continue;
    }

    const ownerId = server.user_id ?? null;
    if (server.user_id) {
      affectedUserIds.add(server.user_id);
    }

    try {
      console.log('[ServerSwap] Stopping local server before swap:', {
        id: server.id,
        ownerId,
        serverType: server.server_type,
        modelName: server.model_name,
        port: server.port,
      });

      await inferenceServerManager.stopServer(server.id, ownerId, evictionClient);
      stoppedServers.push({
        id: server.id,
        user_id: server.user_id,
        server_type: server.server_type,
        status: server.status,
        model_name: server.model_name,
        port: server.port,
      });
    } catch (error) {
      failures.push({
        id: server.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    scope: canEvictGlobally ? 'global' : 'user',
    stoppedServers,
    failures,
    affectedUserIds: Array.from(affectedUserIds),
  };
}

async function clearServerCaches(userIds: string[]): Promise<void> {
  await Promise.all(
    Array.from(new Set(userIds)).map((userId) =>
      cacheDeletePattern(generateCacheKey(SERVER_CACHE_PREFIX, userId))
    )
  );
}

async function startTargetServer(
  server: LocalServerRow,
  userId: string,
  supabase: SupabaseClient
): Promise<ServerInfo> {
  const config = server.config_json ?? {};

  if (server.server_type === STATUS.VLLM) {
    return inferenceServerManager.startVLLM(
      {
        modelPath: server.model_path,
        modelName: server.model_name,
        gpuMemoryUtilization: config.gpu_memory_utilization ?? 0.8,
        maxModelLen: config.max_model_len,
        tensorParallelSize: config.tensor_parallel_size ?? 1,
        dtype: config.dtype ?? 'auto',
        trustRemoteCode: config.trust_remote_code ?? false,
      },
      userId,
      server.training_job_id ?? undefined,
      supabase
    );
  }

  if (server.server_type === STATUS.OLLAMA) {
    return inferenceServerManager.startOllama(
      {
        modelPath: server.model_path,
        modelName: server.model_name,
        contextLength: config.context_length ?? 4096,
      },
      userId,
      server.training_job_id ?? undefined,
      supabase
    );
  }

  throw new Error(`Unsupported server type: ${server.server_type}`);
}

function makeSwapResponse(
  serverInfo: ServerInfo,
  eviction: EvictionResult,
  gpu: GpuMemoryWaitResult
) {
  return NextResponse.json({
    success: true,
    server_id: serverInfo.serverId,
    port: serverInfo.port,
    base_url: serverInfo.baseUrl,
    status: STATUS.STARTING,
    eviction_scope: eviction.scope,
    evicted_servers: eviction.stoppedServers,
    gpu,
    message: `Server swap started on port ${serverInfo.port}.`,
  });
}

export async function POST(req: NextRequest) {
  console.log('[ServerSwap] POST request received');

  try {
    const body = await req.json();
    const { server_id } = body;

    if (!server_id) {
      return jsonError('Missing required field: server_id', 400);
    }

    const auth = await authenticate(req);
    if (auth instanceof NextResponse) {
      return auth;
    }

    return runSerializedSwap(async () => {
      const targetServer = await fetchTargetServer(auth.supabase, server_id, auth.user.id);
      if (targetServer instanceof NextResponse) {
        return targetServer;
      }

      if (targetServer.server_type !== STATUS.VLLM && targetServer.server_type !== STATUS.OLLAMA) {
        return jsonError('Unsupported server type', 400, {
          details: 'Only vLLM and Ollama servers can be swapped locally.',
        });
      }

      const targetStillRunning = isAlreadyRunning(targetServer);
      const eviction = await evictLocalServersForSwap(
        auth.supabase,
        auth.user.id,
        targetServer,
        targetStillRunning
      );

      await clearServerCaches(eviction.affectedUserIds);

      if (eviction.failures.length > 0) {
        return jsonError('Failed to evict existing local servers', 500, {
          failures: eviction.failures,
          eviction_scope: eviction.scope,
        });
      }

      if (targetStillRunning) {
        return NextResponse.json({
          success: true,
          server_id: targetServer.id,
          port: targetServer.port,
          status: STATUS.RUNNING,
          eviction_scope: eviction.scope,
          evicted_servers: eviction.stoppedServers,
          message: 'Target server is already running; other local servers were evicted.',
        });
      }

      const gpu = await waitForGpuMemoryRelease();

      if (gpu.supported && !gpu.released) {
        return jsonError('GPU memory is still in use after eviction', 409, {
          gpu,
          eviction_scope: eviction.scope,
          evicted_servers: eviction.stoppedServers,
        });
      }

      const serverInfo = await startTargetServer(targetServer, auth.user.id, auth.supabase);
      await clearServerCaches(eviction.affectedUserIds);

      return makeSwapResponse(serverInfo, eviction, gpu);
    });
  } catch (error) {
    console.error('[ServerSwap] Error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: 'Failed to swap server',
        details: errorMsg,
      },
      { status: 500 }
    );
  }
}
