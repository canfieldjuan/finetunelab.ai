import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promisify } from 'util';

const execFileMock = vi.hoisted(() => vi.fn());
const execFileCalls = vi.hoisted(() => [] as Array<[string, string[]]>);

vi.mock('child_process', () => ({
  execFile: execFileMock,
}));
vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

function mockExecFile(
  handler: (file: string, args: string[]) => { stdout?: string; error?: Error }
) {
  execFileMock.mockImplementation((file: string, args: string[], _options: unknown, callback: unknown) => {
    execFileCalls.push([file, args]);
    const cb = callback as (error: Error | null, stdout: string, stderr: string) => void;
    const result = handler(file, args);
    cb(result.error ?? null, result.stdout ?? '', '');
  });
  (
    execFileMock as typeof execFileMock & {
      [promisify.custom]?: (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
  }
  )[promisify.custom] = async (file: string, args: string[]) => {
    execFileCalls.push([file, args]);
    const result = handler(file, args);
    if (result.error) {
      throw result.error;
    }
    return { stdout: result.stdout ?? '', stderr: '' };
  };
}

describe('vLLM checker', () => {
  beforeEach(() => {
    vi.resetModules();
    execFileMock.mockReset();
    execFileCalls.length = 0;
    delete process.env.VLLM_PYTHON_PATH;
    delete process.env.PYTHON_PATH;
    delete process.env.VLLM_EXECUTABLE_PATH;
    delete process.env.VLLM_EXTERNAL_URL;
    delete process.env.VERCEL;
    delete process.env.RENDER;
  });

  it('checks env-provided Python paths with execFile argv instead of shell interpolation', async () => {
    process.env.VLLM_PYTHON_PATH = 'python; echo injected';
    process.env.VLLM_EXECUTABLE_PATH = 'vllm';
    mockExecFile((file, args) => {
      if (file === 'python; echo injected' && args[1] === "import vllm; print('OK')") {
        return { stdout: 'OK\n' };
      }
      if (file === 'python; echo injected' && args[1] === 'import vllm; print(vllm.__version__)') {
        return { stdout: '0.16.0\n' };
      }
      if (file === 'vllm' && args[0] === '--version') {
        return { stdout: 'vllm 0.16.0\n' };
      }
      return { error: new Error(`unexpected execFile call: ${file} ${args.join(' ')}`) };
    });

    const {
      getVLLMExecutablePath,
      getVLLMVersion,
      isVLLMAvailable,
    } = await import('../vllm-checker');

    expect(await isVLLMAvailable()).toBe(true);
    expect(await getVLLMExecutablePath()).toBe('vllm');
    expect(await getVLLMVersion()).toBe('0.16.0');
    expect(execFileCalls).toContainEqual([
      'python; echo injected',
      ['-c', "import vllm; print('OK')"],
    ]);
    expect(execFileCalls.map(([file]) => file)).not.toContain(
      'python; echo injected -c "import vllm; print(\'OK\')"'
    );
  });

  it('treats configured external vLLM as effectively available without exposing paths', async () => {
    process.env.VLLM_EXTERNAL_URL = 'https://vllm.example.com';
    mockExecFile(() => ({ error: new Error('missing local vllm') }));

    const { getVLLMRuntimeStatus } = await import('../vllm-checker');

    await expect(getVLLMRuntimeStatus()).resolves.toMatchObject({
      available: true,
      mode: 'external',
      local_available: false,
      external_configured: true,
      version: null,
      configured: {
        executable_path: false,
        python_path: false,
      },
    });
  });
});
