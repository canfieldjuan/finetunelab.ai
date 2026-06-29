import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inferenceServerManager, type ServerInfo } from '@/lib/services/inference-server-manager';
import { waitForGpuMemoryRelease } from '@/lib/services/gpu-memory';
import {
  LOCAL_SERVER_TYPES,
  processServerSwapLock,
  swapServer,
  type EvictionResult,
  type LocalServerRow,
  type ServerConfigJson,
  type ServerSwapResult,
} from '@/lib/services/server-swap';
import { cacheDeletePattern, generateCacheKey } from '@/lib/cache/redis-cache';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { STATUS } from '@/lib/constants';
import { buildVLLMConfigFromServerRow } from '@/lib/services/vllm-runtime-config';

const SERVER_CACHE_PREFIX = 'api:servers';
const EVICTION_CANDIDATE_FILTER = `status.in.(${STATUS.RUNNING},${STATUS.STARTING}),process_id.not.is.null`;

type AuthenticatedUser = {
  id: string;
  email?: string;
};

function jsonError(error: string, status: number, details?: Record<string, unknown>) {
  return NextResponse.json({ error, ...details }, { status });
}

function createAuthenticatedSupabase(authHeader: string): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

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

async function listEvictionCandidates(
  evictionClient: SupabaseClient,
  userId: string,
  canEvictGlobally: boolean
): Promise<LocalServerRow[]> {
  let query = evictionClient
    .from('local_inference_servers')
    .select('*')
    .in('server_type', [...LOCAL_SERVER_TYPES])
    .or(EVICTION_CANDIDATE_FILTER);

  if (!canEvictGlobally) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LocalServerRow[];
}

async function clearServerCaches(userIds: string[]): Promise<void> {
  await Promise.all(
    Array.from(new Set(userIds)).map((userId) =>
      cacheDeletePattern(generateCacheKey(SERVER_CACHE_PREFIX, userId))
    )
  );
}

async function startServerFromRecord(
  server: LocalServerRow,
  userId: string | null,
  supabase: SupabaseClient
): Promise<ServerInfo> {
  const config: ServerConfigJson = server.config_json ?? {};

  if (server.server_type === STATUS.VLLM) {
    return inferenceServerManager.startVLLM(
      buildVLLMConfigFromServerRow(server),
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

function stoppedServersPayload(eviction: EvictionResult) {
  return {
    eviction_scope: eviction.scope,
    evicted_servers: eviction.stoppedServers,
  };
}

function resultToResponse(result: ServerSwapResult): NextResponse {
  if (result.ok && result.kind === 'already_running') {
    return NextResponse.json({
      success: true,
      server_id: result.targetServer.id,
      port: result.targetServer.port,
      status: STATUS.RUNNING,
      ...stoppedServersPayload(result.eviction),
      message: 'Target server is already running; other local servers were evicted.',
    });
  }

  if (result.ok && result.kind === 'started') {
    return NextResponse.json({
      success: true,
      server_id: result.serverInfo.serverId,
      port: result.serverInfo.port,
      base_url: result.serverInfo.baseUrl,
      status: STATUS.STARTING,
      ...stoppedServersPayload(result.eviction),
      gpu: result.gpu,
      message: `Server swap started on port ${result.serverInfo.port}.`,
    });
  }

  if (!result.ok && result.kind === 'eviction_failed') {
    return jsonError(result.error, result.statusCode, {
      failures: result.eviction.failures,
      ...stoppedServersPayload(result.eviction),
    });
  }

  if (!result.ok && result.kind === 'gpu_not_released') {
    return jsonError(result.error, result.statusCode, {
      gpu: result.gpu,
      ...stoppedServersPayload(result.eviction),
    });
  }

  return jsonError(result.error, result.statusCode, {
    details: result.details,
    partial_failure: true,
    gpu_empty: result.gpuEmpty,
    gpu: result.gpu,
    restart_attempt: result.restartAttempt,
    ...stoppedServersPayload(result.eviction),
    message: result.gpuEmpty
      ? 'Existing local servers were evicted and the target failed to start; the GPU is currently empty.'
      : 'The target failed to start after eviction; a previous local server restart was attempted successfully.',
  });
}

export async function handleServerSwapRequest(req: NextRequest): Promise<NextResponse> {
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

    const targetServer = await fetchTargetServer(auth.supabase, server_id, auth.user.id);
    if (targetServer instanceof NextResponse) {
      return targetServer;
    }

    if (targetServer.server_type !== STATUS.VLLM && targetServer.server_type !== STATUS.OLLAMA) {
      return jsonError('Unsupported server type', 400, {
        details: 'Only vLLM and Ollama servers can be swapped locally.',
      });
    }

    const evictionClient = supabaseAdmin ?? auth.supabase;
    const canEvictGlobally = Boolean(supabaseAdmin);

    const result = await swapServer({
      targetServer,
      userId: auth.user.id,
      scope: canEvictGlobally ? 'global' : 'user',
      lock: processServerSwapLock,
      deps: {
        listEvictionCandidates: () =>
          listEvictionCandidates(evictionClient, auth.user.id, canEvictGlobally),
        stopServer: (server) =>
          inferenceServerManager.stopServer(server.id, server.user_id ?? null, evictionClient),
        startServer: (server) =>
          startServerFromRecord(server, auth.user.id, auth.supabase),
        restartServer: (server) =>
          startServerFromRecord(server, server.user_id ?? null, evictionClient),
        waitForGpuMemory: () => waitForGpuMemoryRelease(),
        isServerRunning: isAlreadyRunning,
        clearCaches: clearServerCaches,
      },
    });

    return resultToResponse(result);
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
