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
const CACHE_DURATION = 60000; // Cache for 1 minute

/**
 * Check if vLLM is available
 */
export async function isVLLMAvailable(): Promise<boolean> {
  // Return cached result if recent
  if (vllmAvailable !== null && Date.now() - lastCheck < CACHE_DURATION) {
    return vllmAvailable;
  }

  try {
    const pythonPath = process.env.VLLM_PYTHON_PATH || 'python';
    
    // Try to import vllm
    const { stdout } = await execAsync(
      `${pythonPath} -c "import vllm; print('OK')"`,
      { timeout: 5000 }
    );

    vllmAvailable = stdout.trim() === 'OK';
    lastCheck = Date.now();
    
    console.log('[vLLMChecker] vLLM available:', vllmAvailable);
    return vllmAvailable;
  } catch (error) {
    console.log('[vLLMChecker] vLLM not available:', error instanceof Error ? error.message : String(error));
    vllmAvailable = false;
    lastCheck = Date.now();
    return false;
  }
}

/**
 * Get vLLM version
 */
export async function getVLLMVersion(): Promise<string | null> {
  try {
    const pythonPath = process.env.VLLM_PYTHON_PATH || 'python';
    
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
