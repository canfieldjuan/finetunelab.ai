/**
 * vLLM Availability Checker
 * 
 * Checks if vLLM is installed and available
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let vllmAvailable: boolean | null = null;
let lastCheck: number = 0;
let cachedPythonPath: string | null = null;
const CACHE_DURATION = 60000; // Cache for 1 minute

async function findVLLMPythonPath(): Promise<string | null> {
  const candidates = [
    process.env.VLLM_PYTHON_PATH,
    process.env.PYTHON_PATH,
    'python3',
    'python',
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const pythonPath of candidates) {
    try {
      const { stdout } = await execAsync(
        `${pythonPath} -c "import vllm; print('OK')"`,
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
  vllmAvailable = Boolean(cachedPythonPath);
  lastCheck = Date.now();

  console.log('[vLLMChecker] vLLM available:', vllmAvailable, 'python:', cachedPythonPath || 'none');
  return vllmAvailable;
}

/**
 * Get vLLM version
 */
export async function getVLLMVersion(): Promise<string | null> {
  try {
    const pythonPath = cachedPythonPath || await findVLLMPythonPath();
    if (!pythonPath) return null;

    const { stdout } = await execAsync(
      `${pythonPath} -c "import vllm; print(vllm.__version__)"`,
      { timeout: 5000 }
    );

    return stdout.trim();
  } catch {
    return null;
  }
}

console.log('[vLLMChecker] Service loaded');
