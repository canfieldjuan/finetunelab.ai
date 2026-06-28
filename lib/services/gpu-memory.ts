import { execFileSync } from 'child_process';

export interface GpuMemoryProbe {
  supported: boolean;
  usedMb: number[];
  reason?: string;
}

export interface GpuMemoryWaitOptions {
  maxUsedMb?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
  probe?: () => GpuMemoryProbe;
  sleep?: (ms: number) => Promise<void>;
}

export interface GpuMemoryWaitResult {
  supported: boolean;
  released: boolean;
  thresholdMb: number;
  usedMb: number[];
  waitedMs: number;
  reason?: string;
}

const DEFAULT_MAX_USED_MB = 1024;
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;

function readNonNegativeNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function parseNvidiaSmiMemoryUsed(output: string): number[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)/);
      return match ? Number.parseInt(match[1], 10) : Number.NaN;
    })
    .filter((value) => Number.isFinite(value));
}

export function probeNvidiaSmiMemory(): GpuMemoryProbe {
  try {
    const output = execFileSync(
      'nvidia-smi',
      ['--query-gpu=memory.used', '--format=csv,noheader,nounits'],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5_000 }
    );

    const usedMb = parseNvidiaSmiMemoryUsed(output);
    if (usedMb.length === 0) {
      return {
        supported: false,
        usedMb: [],
        reason: 'nvidia-smi returned no GPU memory rows',
      };
    }

    return { supported: true, usedMb };
  } catch (error) {
    return {
      supported: false,
      usedMb: [],
      reason: error instanceof Error ? error.message : 'nvidia-smi unavailable',
    };
  }
}

export async function waitForGpuMemoryRelease(options: GpuMemoryWaitOptions = {}): Promise<GpuMemoryWaitResult> {
  const thresholdMb = options.maxUsedMb ?? readNonNegativeNumber(process.env.MODEL_SWAP_MAX_GPU_USED_MB, DEFAULT_MAX_USED_MB);
  const timeoutMs = options.timeoutMs ?? readNonNegativeNumber(process.env.MODEL_SWAP_VRAM_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const pollIntervalMs = options.pollIntervalMs ?? readNonNegativeNumber(process.env.MODEL_SWAP_VRAM_POLL_MS, DEFAULT_POLL_INTERVAL_MS);
  const probe = options.probe ?? probeNvidiaSmiMemory;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const start = Date.now();

  while (true) {
    const snapshot = probe();
    const waitedMs = Date.now() - start;

    if (!snapshot.supported) {
      console.warn('[GpuMemory] GPU memory probe unavailable; proceeding without a VRAM-settle gate:', snapshot.reason);

      return {
        supported: false,
        released: true,
        thresholdMb,
        usedMb: snapshot.usedMb,
        waitedMs,
        reason: snapshot.reason ?? 'GPU memory probe unavailable',
      };
    }

    const released = snapshot.usedMb.every((usedMb) => usedMb <= thresholdMb);
    if (released) {
      return {
        supported: true,
        released: true,
        thresholdMb,
        usedMb: snapshot.usedMb,
        waitedMs,
      };
    }

    if (waitedMs >= timeoutMs) {
      return {
        supported: true,
        released: false,
        thresholdMb,
        usedMb: snapshot.usedMb,
        waitedMs,
        reason: `GPU memory stayed above ${thresholdMb} MB after ${timeoutMs} ms`,
      };
    }

    await sleep(pollIntervalMs);
  }
}
