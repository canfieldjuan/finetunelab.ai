import { STATUS } from '@/lib/constants';
import type { GpuMemoryWaitResult } from './gpu-memory';
import type { ServerInfo } from './inference-server-manager';

export const LOCAL_SERVER_TYPES = [STATUS.VLLM, STATUS.OLLAMA, 'simple'] as const;

export type ServerConfigJson = {
  gpu_memory_utilization?: number;
  max_model_len?: number;
  tensor_parallel_size?: number;
  dtype?: 'auto' | 'half' | 'float16' | 'bfloat16' | 'float32';
  trust_remote_code?: boolean;
  enable_auto_tool_choice?: boolean;
  tool_call_parser?: string;
  chat_template?: string;
  chat_template_content_format?: 'auto' | 'openai' | 'string';
  context_length?: number;
  external?: boolean;
};

export type LocalServerRow = {
  id: string;
  user_id: string | null;
  name?: string | null;
  server_type: string;
  status: string;
  base_url?: string | null;
  model_path: string;
  model_name: string;
  port: number | null;
  process_id: number | null;
  training_job_id?: string | null;
  config_json?: ServerConfigJson | null;
};

export type EvictedServerSummary = {
  id: string;
  user_id: string | null;
  server_type: string;
  status: string;
  model_name: string;
  port: number | null;
};

export type EvictionResult = {
  scope: 'global' | 'user';
  stoppedServers: EvictedServerSummary[];
  failures: Array<{
    id: string;
    error: string;
  }>;
  affectedUserIds: string[];
};

export type RestartAttempt = {
  attempted: boolean;
  success?: boolean;
  server?: EvictedServerSummary;
  serverInfo?: ServerInfo;
  error?: string;
  reason?: string;
};

export type ServerSwapResult =
  | {
      ok: true;
      kind: 'already_running';
      targetServer: LocalServerRow;
      eviction: EvictionResult;
    }
  | {
      ok: true;
      kind: 'started';
      serverInfo: ServerInfo;
      eviction: EvictionResult;
      gpu: GpuMemoryWaitResult;
    }
  | {
      ok: false;
      kind: 'eviction_failed';
      statusCode: 500;
      error: string;
      eviction: EvictionResult;
    }
  | {
      ok: false;
      kind: 'gpu_not_released';
      statusCode: 409;
      error: string;
      eviction: EvictionResult;
      gpu: GpuMemoryWaitResult;
    }
  | {
      ok: false;
      kind: 'start_failed';
      statusCode: 500;
      error: string;
      details: string;
      eviction: EvictionResult;
      gpu: GpuMemoryWaitResult;
      restartAttempt: RestartAttempt;
      gpuEmpty: boolean;
    };

export interface ServerSwapDependencies {
  listEvictionCandidates: () => Promise<LocalServerRow[]>;
  stopServer: (server: LocalServerRow) => Promise<void>;
  startServer: (server: LocalServerRow) => Promise<ServerInfo>;
  restartServer?: (server: LocalServerRow) => Promise<ServerInfo>;
  waitForGpuMemory: () => Promise<GpuMemoryWaitResult>;
  isServerRunning: (server: LocalServerRow) => boolean;
  clearCaches: (userIds: string[]) => Promise<void>;
}

export class ServerSwapLock {
  private queue: Promise<void> = Promise.resolve();

  async run<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;

    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await operation();
    } finally {
      release();
    }
  }
}

export const processServerSwapLock = new ServerSwapLock();

function serverSummary(server: LocalServerRow): EvictedServerSummary {
  return {
    id: server.id,
    user_id: server.user_id,
    server_type: server.server_type,
    status: server.status,
    model_name: server.model_name,
    port: server.port,
  };
}

function isExternalServer(server: LocalServerRow): boolean {
  return Boolean(server.config_json?.external);
}

function hasLocalProcessRecord(server: LocalServerRow): boolean {
  return Boolean(server.process_id);
}

function isActiveServer(server: LocalServerRow): boolean {
  return server.status === STATUS.RUNNING || server.status === STATUS.STARTING;
}

export function shouldEvictServer(
  server: LocalServerRow,
  targetServer: LocalServerRow,
  keepTargetRunning: boolean
): boolean {
  if (keepTargetRunning && server.id === targetServer.id) {
    return false;
  }

  if (isExternalServer(server)) {
    return false;
  }

  return isActiveServer(server) || hasLocalProcessRecord(server);
}

async function evictLocalServers(
  deps: ServerSwapDependencies,
  userId: string,
  targetServer: LocalServerRow,
  keepTargetRunning: boolean,
  scope: EvictionResult['scope']
): Promise<{ eviction: EvictionResult; stoppedRows: LocalServerRow[] }> {
  const candidates = await deps.listEvictionCandidates();
  const stoppedRows: LocalServerRow[] = [];
  const stoppedServers: EvictedServerSummary[] = [];
  const failures: EvictionResult['failures'] = [];
  const affectedUserIds = new Set<string>([userId]);

  for (const server of candidates) {
    if (!shouldEvictServer(server, targetServer, keepTargetRunning)) {
      continue;
    }

    if (server.user_id) {
      affectedUserIds.add(server.user_id);
    }

    try {
      await deps.stopServer(server);
      stoppedRows.push(server);
      stoppedServers.push(serverSummary(server));
    } catch (error) {
      failures.push({
        id: server.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    stoppedRows,
    eviction: {
      scope,
      stoppedServers,
      failures,
      affectedUserIds: Array.from(affectedUserIds),
    },
  };
}

function selectRestartCandidate(
  stoppedRows: LocalServerRow[],
  targetServer: LocalServerRow
): LocalServerRow | undefined {
  return stoppedRows.find(
    (server) =>
      server.id !== targetServer.id &&
      server.status === STATUS.RUNNING &&
      !isExternalServer(server)
  );
}

async function tryRestartPreviousServer(
  deps: ServerSwapDependencies,
  stoppedRows: LocalServerRow[],
  targetServer: LocalServerRow
): Promise<RestartAttempt> {
  if (!deps.restartServer) {
    return {
      attempted: false,
      reason: 'No restart dependency was provided.',
    };
  }

  const candidate = selectRestartCandidate(stoppedRows, targetServer);
  if (!candidate) {
    return {
      attempted: false,
      reason: 'No previously running local server was evicted.',
    };
  }

  try {
    const serverInfo = await deps.restartServer(candidate);
    return {
      attempted: true,
      success: true,
      server: serverSummary(candidate),
      serverInfo,
    };
  } catch (error) {
    return {
      attempted: true,
      success: false,
      server: serverSummary(candidate),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function swapServer({
  targetServer,
  userId,
  scope,
  deps,
  lock = processServerSwapLock,
}: {
  targetServer: LocalServerRow;
  userId: string;
  scope: EvictionResult['scope'];
  deps: ServerSwapDependencies;
  lock?: ServerSwapLock;
}): Promise<ServerSwapResult> {
  return lock.run(async () => {
    const targetStillRunning = deps.isServerRunning(targetServer);
    const { eviction, stoppedRows } = await evictLocalServers(
      deps,
      userId,
      targetServer,
      targetStillRunning,
      scope
    );

    await deps.clearCaches(eviction.affectedUserIds);

    if (eviction.failures.length > 0) {
      return {
        ok: false,
        kind: 'eviction_failed',
        statusCode: 500,
        error: 'Failed to evict existing local servers',
        eviction,
      };
    }

    if (targetStillRunning) {
      return {
        ok: true,
        kind: 'already_running',
        targetServer,
        eviction,
      };
    }

    const gpu = await deps.waitForGpuMemory();

    if (gpu.supported && !gpu.released) {
      return {
        ok: false,
        kind: 'gpu_not_released',
        statusCode: 409,
        error: 'GPU memory is still in use after eviction',
        eviction,
        gpu,
      };
    }

    try {
      const serverInfo = await deps.startServer(targetServer);
      await deps.clearCaches(eviction.affectedUserIds);

      return {
        ok: true,
        kind: 'started',
        serverInfo,
        eviction,
        gpu,
      };
    } catch (error) {
      const restartAttempt = await tryRestartPreviousServer(deps, stoppedRows, targetServer);
      await deps.clearCaches(eviction.affectedUserIds);

      return {
        ok: false,
        kind: 'start_failed',
        statusCode: 500,
        error: 'Failed to start target server after evicting existing local servers',
        details: error instanceof Error ? error.message : String(error),
        eviction,
        gpu,
        restartAttempt,
        gpuEmpty: restartAttempt.success !== true,
      };
    }
  });
}
