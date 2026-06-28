import { describe, expect, it } from 'vitest';
import { STATUS } from '@/lib/constants';
import {
  ServerSwapLock,
  shouldEvictServer,
  swapServer,
  type LocalServerRow,
  type ServerSwapDependencies,
} from '../server-swap';

function server(overrides: Partial<LocalServerRow> = {}): LocalServerRow {
  return {
    id: overrides.id ?? 'server-1',
    user_id: overrides.user_id ?? 'user-1',
    server_type: overrides.server_type ?? STATUS.VLLM,
    status: overrides.status ?? STATUS.STOPPED,
    model_path: overrides.model_path ?? '/models/target',
    model_name: overrides.model_name ?? 'target',
    port: overrides.port ?? 8002,
    process_id: overrides.process_id ?? null,
    training_job_id: overrides.training_job_id,
    config_json: overrides.config_json ?? {},
  };
}

function gpuReleased() {
  return {
    supported: true,
    released: true,
    thresholdMb: 512,
    usedMb: [128],
    waitedMs: 0,
  };
}

function deps(overrides: Partial<ServerSwapDependencies> = {}): ServerSwapDependencies {
  return {
    listEvictionCandidates: async () => [],
    stopServer: async () => undefined,
    startServer: async (row) => ({
      serverId: `${row.id}-started`,
      baseUrl: 'http://127.0.0.1:8002',
      port: 8002,
      status: 'starting',
    }),
    restartServer: async (row) => ({
      serverId: `${row.id}-restarted`,
      baseUrl: 'http://127.0.0.1:8003',
      port: 8003,
      status: 'starting',
    }),
    waitForGpuMemory: async () => gpuReleased(),
    isServerRunning: () => false,
    clearCaches: async () => undefined,
    ...overrides,
  };
}

describe('server-swap orchestration', () => {
  it('serializes concurrent swaps through the shared lock', async () => {
    const lock = new ServerSwapLock();
    let activeStarts = 0;
    let maxActiveStarts = 0;

    const runSwap = (target: LocalServerRow) =>
      swapServer({
        targetServer: target,
        userId: 'user-1',
        scope: 'user',
        lock,
        deps: deps({
          startServer: async (row) => {
            activeStarts += 1;
            maxActiveStarts = Math.max(maxActiveStarts, activeStarts);
            await new Promise((resolve) => setTimeout(resolve, 10));
            activeStarts -= 1;
            return {
              serverId: `${row.id}-started`,
              baseUrl: 'http://127.0.0.1:8002',
              port: 8002,
              status: 'starting',
            };
          },
        }),
      });

    const [first, second] = await Promise.all([
      runSwap(server({ id: 'target-a' })),
      runSwap(server({ id: 'target-b' })),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(maxActiveStarts).toBe(1);
  });

  it('evicts local active and stale-pid servers while keeping a live target running', async () => {
    const target = server({
      id: 'target',
      status: STATUS.RUNNING,
      process_id: 111,
    });
    const activeOther = server({
      id: 'active-other',
      status: STATUS.RUNNING,
      process_id: 222,
      model_name: 'old-active',
    });
    const stalePid = server({
      id: 'stale-pid',
      status: STATUS.ERROR,
      process_id: 333,
      model_name: 'old-stale',
    });
    const external = server({
      id: 'external-vllm',
      status: STATUS.RUNNING,
      process_id: null,
      config_json: { external: true },
      model_name: 'external',
    });
    const stoppedNoPid = server({
      id: 'stopped-no-pid',
      status: STATUS.STOPPED,
      process_id: null,
      model_name: 'cold',
    });
    const stopped: string[] = [];

    const result = await swapServer({
      targetServer: target,
      userId: 'user-1',
      scope: 'global',
      lock: new ServerSwapLock(),
      deps: deps({
        listEvictionCandidates: async () => [target, activeOther, stalePid, external, stoppedNoPid],
        stopServer: async (row) => {
          stopped.push(row.id);
        },
        isServerRunning: (row) => row.id === 'target',
        startServer: async () => {
          throw new Error('target should not be restarted');
        },
      }),
    });

    expect(result).toMatchObject({
      ok: true,
      kind: 'already_running',
    });
    expect(stopped).toEqual(['active-other', 'stale-pid']);
  });

  it('surfaces start failure after eviction and attempts to restart the previous model', async () => {
    const target = server({ id: 'target' });
    const oldModel = server({
      id: 'old-model',
      status: STATUS.RUNNING,
      process_id: 444,
      model_name: 'previous',
    });
    const stopped: string[] = [];
    const restarted: string[] = [];

    const result = await swapServer({
      targetServer: target,
      userId: 'user-1',
      scope: 'user',
      lock: new ServerSwapLock(),
      deps: deps({
        listEvictionCandidates: async () => [oldModel],
        stopServer: async (row) => {
          stopped.push(row.id);
        },
        startServer: async () => {
          throw new Error('bad model path');
        },
        restartServer: async (row) => {
          restarted.push(row.id);
          return {
            serverId: `${row.id}-restarted`,
            baseUrl: 'http://127.0.0.1:8003',
            port: 8003,
            status: 'starting',
          };
        },
      }),
    });

    expect(result).toMatchObject({
      ok: false,
      kind: 'start_failed',
      statusCode: 500,
      details: 'bad model path',
      gpuEmpty: false,
      restartAttempt: {
        attempted: true,
        success: true,
        server: {
          id: 'old-model',
        },
      },
    });
    expect(stopped).toEqual(['old-model']);
    expect(restarted).toEqual(['old-model']);
  });

  it('does not evict external server records or stopped rows without a process id', () => {
    const target = server({ id: 'target' });

    expect(
      shouldEvictServer(
        server({ id: 'external', status: STATUS.RUNNING, config_json: { external: true } }),
        target,
        false
      )
    ).toBe(false);
    expect(
      shouldEvictServer(
        server({ id: 'cold', status: STATUS.STOPPED, process_id: null }),
        target,
        false
      )
    ).toBe(false);
    expect(
      shouldEvictServer(
        server({ id: 'stale', status: STATUS.STOPPED, process_id: 555 }),
        target,
        false
      )
    ).toBe(true);
  });
});
