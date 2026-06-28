import { describe, expect, it } from 'vitest';
import {
  parseNvidiaSmiMemoryUsed,
  waitForGpuMemoryRelease,
  type GpuMemoryProbe,
} from '../gpu-memory';

describe('gpu-memory', () => {
  it('parses nvidia-smi memory.used rows', () => {
    expect(parseNvidiaSmiMemoryUsed('0\n512\n12048\n')).toEqual([0, 512, 12048]);
    expect(parseNvidiaSmiMemoryUsed('128 MiB\nbad row\n256\n')).toEqual([128, 256]);
  });

  it('skips the wait when the GPU memory probe is unavailable', async () => {
    const result = await waitForGpuMemoryRelease({
      maxUsedMb: 512,
      probe: () => ({ supported: false, usedMb: [], reason: 'nvidia-smi unavailable' }),
    });

    expect(result.supported).toBe(false);
    expect(result.released).toBe(true);
    expect(result.reason).toBe('nvidia-smi unavailable');
  });

  it('waits until every GPU is below the configured memory threshold', async () => {
    const snapshots: GpuMemoryProbe[] = [
      { supported: true, usedMb: [8192, 256] },
      { supported: true, usedMb: [256, 128] },
    ];

    const result = await waitForGpuMemoryRelease({
      maxUsedMb: 512,
      timeoutMs: 5_000,
      pollIntervalMs: 1,
      probe: () => snapshots.shift() ?? { supported: true, usedMb: [256, 128] },
      sleep: async () => undefined,
    });

    expect(result.supported).toBe(true);
    expect(result.released).toBe(true);
    expect(result.usedMb).toEqual([256, 128]);
  });

  it('fails closed when GPU memory stays above the threshold', async () => {
    const result = await waitForGpuMemoryRelease({
      maxUsedMb: 512,
      timeoutMs: 0,
      probe: () => ({ supported: true, usedMb: [8192] }),
      sleep: async () => undefined,
    });

    expect(result.supported).toBe(true);
    expect(result.released).toBe(false);
    expect(result.usedMb).toEqual([8192]);
    expect(result.reason).toContain('above 512 MB');
  });
});
