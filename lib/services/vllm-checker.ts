/**
 * vLLM Availability Checker
 * 
 * Checks if vLLM is installed and available
 */

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

let vllmAvailable: boolean | null = null;
let lastCheck: number = 0;
let cachedPythonPath: string | null = null;
let cachedExecutablePath: string | null = null;
const CACHE_DURATION = 60000; // Cache for 1 minute

export type VLLMRuntimeMode = 'local' | 'external' | 'unavailable';

export interface VLLMRuntimeStatus {
  available: boolean;
  mode: VLLMRuntimeMode;
  local_available: boolean;
  external_configured: boolean;
  cloud_runtime: boolean;
  requires_external: boolean;
  version: string | null;
  configured: {
    executable_path: boolean;
    python_path: boolean;
  };
  message: string;
}

function hasPathSeparator(value: string): boolean {
  return value.includes('/') || value.includes('\\');
}

function canExecute(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function commandWorks(command: string): Promise<boolean> {
  try {
    await execFileAsync(command, ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function resolveVLLMExecutable(pythonPath?: string | null): Promise<string | null> {
  if (pythonPath && hasPathSeparator(pythonPath)) {
    const executable = process.platform === 'win32' ? 'vllm.exe' : 'vllm';
    const sibling = path.join(path.dirname(pythonPath), executable);
    if (canExecute(sibling)) {
      return sibling;
    }
  }

  const trainerExecutable = path.join(
    process.cwd(),
    'lib',
    'training',
    'trainer_venv',
    'bin',
    'vllm'
  );
  if (canExecute(trainerExecutable)) {
    return trainerExecutable;
  }

  return await commandWorks('vllm') ? 'vllm' : null;
}

export async function getVLLMExecutablePath(): Promise<string | null> {
  if (cachedExecutablePath) {
    return cachedExecutablePath;
  }

  const configuredExecutable = process.env.VLLM_EXECUTABLE_PATH;
  if (configuredExecutable) {
    if (hasPathSeparator(configuredExecutable)) {
      if (canExecute(configuredExecutable)) {
        cachedExecutablePath = configuredExecutable;
        return cachedExecutablePath;
      }
    } else if (await commandWorks(configuredExecutable)) {
      cachedExecutablePath = configuredExecutable;
      return cachedExecutablePath;
    }
  }

  const pythonPath = cachedPythonPath || await findVLLMPythonPath();
  cachedExecutablePath = await resolveVLLMExecutable(pythonPath);
  return cachedExecutablePath;
}

async function findVLLMPythonPath(): Promise<string | null> {
  const candidates = [
    process.env.VLLM_PYTHON_PATH,
    process.env.PYTHON_PATH,
    'python3',
    'python',
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const pythonPath of candidates) {
    try {
      const { stdout } = await execFileAsync(
        pythonPath,
        ['-c', "import vllm; print('OK')"],
        { timeout: 5000 }
      );

      if (stdout.trim() === 'OK') {
        return pythonPath;
      }
    } catch (error) {
      console.log(
        '[vLLMChecker] Python candidate missing vLLM:',
        pythonPath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return null;
}

/**
 * Check if vLLM is available
 */
export async function isVLLMAvailable(): Promise<boolean> {
  // Return cached result if recent
  if (vllmAvailable !== null && Date.now() - lastCheck < CACHE_DURATION) {
    return vllmAvailable;
  }

  cachedPythonPath = await findVLLMPythonPath();
  cachedExecutablePath = await getVLLMExecutablePath();
  vllmAvailable = Boolean(cachedExecutablePath);
  lastCheck = Date.now();

  console.log('[vLLMChecker] vLLM available:', vllmAvailable, 'python:', cachedPythonPath || 'none', 'executable:', cachedExecutablePath || 'none');
  return vllmAvailable;
}

/**
 * Get vLLM version
 */
export async function getVLLMVersion(): Promise<string | null> {
  try {
    const pythonPath = cachedPythonPath || await findVLLMPythonPath();
    if (!pythonPath) return null;

    const { stdout } = await execFileAsync(
      pythonPath,
      ['-c', 'import vllm; print(vllm.__version__)'],
      { timeout: 5000 }
    );

    return stdout.trim();
  } catch {
    return null;
  }
}

export async function getVLLMRuntimeStatus(): Promise<VLLMRuntimeStatus> {
  const externalConfigured = Boolean(process.env.VLLM_EXTERNAL_URL);
  const cloudRuntime = Boolean(process.env.VERCEL || process.env.RENDER);
  const localAvailable = await isVLLMAvailable();
  const version = localAvailable ? await getVLLMVersion() : null;

  const requiresExternal = cloudRuntime && !externalConfigured;
  const mode: VLLMRuntimeMode = externalConfigured
    ? 'external'
    : localAvailable && !requiresExternal
      ? 'local'
      : 'unavailable';

  const available = externalConfigured || (localAvailable && !requiresExternal);

  return {
    available,
    mode,
    local_available: localAvailable,
    external_configured: externalConfigured,
    cloud_runtime: cloudRuntime,
    requires_external: requiresExternal,
    version,
    configured: {
      executable_path: Boolean(process.env.VLLM_EXECUTABLE_PATH),
      python_path: Boolean(process.env.VLLM_PYTHON_PATH || process.env.PYTHON_PATH),
    },
    message: externalConfigured
      ? 'External vLLM endpoint is configured'
      : requiresExternal
        ? 'External vLLM endpoint is required in this runtime'
      : localAvailable
        ? 'Local vLLM is installed and ready'
        : 'vLLM not found. Install with: pip install vllm',
  };
}

console.log('[vLLMChecker] Service loaded');
