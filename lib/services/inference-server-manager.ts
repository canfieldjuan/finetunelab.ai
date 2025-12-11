/**
 * Inference Server Manager
 *
 * Handles lifecycle of local inference servers (vLLM, Ollama)
 * - Spawns servers with optimal configuration
 * - Manages port allocation (8002-8020)
 * - Health checking and monitoring
 * - Process cleanup and recovery
 *
 * Phase: Tier 2 - Training Integration
 * Date: 2025-10-28
 */

import { spawn, ChildProcess, execSync, spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as net from 'net';
import * as path from 'path';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateModelfile, saveModelfile } from './ollama-modelfile-generator';
import { ENDPOINTS, PORTS } from '@/lib/config/endpoints';

// Resolve the python executable we will use for vLLM on Linux systems
function resolvePythonExecutable(): string {
  // On Vercel, Python is not available - this function should not be called
  if (process.env.VERCEL) {
    throw new Error(
      'Python executable resolution is not available on Vercel. ' +
      'Use VLLM_EXTERNAL_URL to connect to an external vLLM server.'
    );
  }

  const candidates = [
    process.env.VLLM_PYTHON_PATH,
    process.env.PYTHON_PATH,
    'python3',
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const check = spawnSync(candidate, ['--version'], { encoding: 'utf-8' });

    if (check.error) {
      console.error(
        '[InferenceServerManager] Python check failed:',
        candidate,
        check.error.message
      );
      continue;
    }

    if (check.status === 0) {
      console.log(
        '[InferenceServerManager] Using python executable:',
        candidate,
        check.stdout.trim() || check.stderr.trim()
      );
      return candidate;
    }

    console.error(
      '[InferenceServerManager] Python candidate exited with non-zero status:',
      candidate,
      'status:',
      check.status,
      'stderr:',
      check.stderr?.toString().trim()
    );
  }

  throw new Error(
    'No usable python3 executable found. Set VLLM_PYTHON_PATH to the python environment with vLLM installed.'
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

// Ollama requires model names with only lowercase letters, digits, '-', '_', and '.'
// Spaces and uppercase are invalid. This helper sanitizes arbitrary names.
export function sanitizeOllamaModelName(name: string): string {
  const lower = (name || 'model').toLowerCase();
  // Replace any invalid char with '-'
  let cleaned = lower.replace(/[^a-z0-9._-]+/g, '-');
  // Collapse multiple dashes
  cleaned = cleaned.replace(/-+/g, '-');
  // Trim leading/trailing separators
  cleaned = cleaned.replace(/^[-.]+|[-.]+$/g, '');
  // Fallback if empty
  if (!cleaned) cleaned = `model-${Date.now()}`;
  // Reasonable length limit
  if (cleaned.length > 128) cleaned = cleaned.slice(0, 128).replace(/[-.]+$/g, '');
  return cleaned;
}

// ============================================================================
// Types
// ============================================================================

export interface VLLMConfig {
  modelPath: string;
  modelName: string;
  gpuMemoryUtilization?: number; // 0.0 - 1.0, default 0.8
  maxModelLen?: number; // Max sequence length
  tensorParallelSize?: number; // Multi-GPU support
  dtype?: 'auto' | 'half' | 'float16' | 'bfloat16' | 'float32';
  trustRemoteCode?: boolean;
}

export interface OllamaConfig {
  modelPath: string;
  modelName: string;
  contextLength?: number;
}

export interface ServerInfo {
  serverId: string;
  baseUrl: string;
  port: number;
  pid?: number;
  status: 'starting' | 'running' | 'error';
  errorMessage?: string;
}

// Narrowed status type for updates and state transitions
type ServerStatus = 'starting' | 'running' | 'stopped' | 'error';

// Payload for partial updates to local_inference_servers
interface ServerUpdatePayload {
  status: ServerStatus;
  stopped_at?: string;
  error_message?: string;
  last_health_check?: string;
}

// ============================================================================
// Inference Server Manager
// ============================================================================

export class InferenceServerManager {
  private processes: Map<string, ChildProcess> = new Map();

  constructor() {
    // Clean up zombie processes on startup (processes marked as running but actually dead)
    this.cleanupZombieProcesses(null).catch(err =>
      console.error('[InferenceServerManager] Failed to cleanup zombies on startup:', err)
    );
  }

  /**
   * Start vLLM server with trained model
   */
  async startVLLM(
    config: VLLMConfig,
    userId: string | null,
    trainingJobId: string | undefined,
    supabaseClient: SupabaseClient
  ): Promise<ServerInfo> {
    console.log('[InferenceServerManager] Starting vLLM server:', config.modelName);

    // On Vercel or when external URL is configured, use external vLLM server
    if (process.env.VERCEL || process.env.VLLM_EXTERNAL_URL) {
      const externalUrl = process.env.VLLM_EXTERNAL_URL;

      if (!externalUrl) {
        throw new Error(
          'Cannot spawn vLLM on Vercel serverless environment. ' +
          'Set VLLM_EXTERNAL_URL to point to an external vLLM server, ' +
          'or deploy inference workloads to a dedicated GPU server (e.g., RunPod).'
        );
      }

      console.log('[InferenceServerManager] Using external vLLM server:', externalUrl);

      // Create a record for the external server reference
      const serverId = `external-vllm-${Date.now()}`;
      const { error: dbError } = await supabaseClient
        .from('local_inference_servers')
        .insert({
          id: serverId,
          user_id: userId,
          server_type: 'vllm',
          name: config.modelName,
          base_url: externalUrl,
          port: 0, // External server, port managed externally
          model_path: config.modelPath,
          model_name: config.modelName,
          training_job_id: trainingJobId || null,
          process_id: null, // No local process
          status: 'running', // Assume external server is running
          config_json: {
            external: true,
            external_url: externalUrl,
          },
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (dbError) {
        console.error('[InferenceServerManager] Failed to create external server record:', dbError);
        // Non-fatal for external servers - still return the info
      }

      return {
        serverId,
        baseUrl: externalUrl,
        port: 0,
        status: 'running',
      };
    }

    try {
      // Find available port in range 8002-8020
      const port = await this.findAvailablePort(8002, 8020, userId, supabaseClient);
      console.log('[InferenceServerManager] Allocated port:', port);

      // Check if this is a LoRA adapter checkpoint
      let actualModelPath = config.modelPath;
      let loraAdapterPath: string | null = null;
      let isLoraAdapter = false;
      let loraRank: number | null = null;

      try {
        const adapterConfigPath = path.join(config.modelPath, 'adapter_config.json');
        const adapterConfigContent = await fs.readFile(adapterConfigPath, 'utf-8');
        const adapterConfig = JSON.parse(adapterConfigContent);

        if (adapterConfig.base_model_name_or_path) {
          isLoraAdapter = true;
          loraAdapterPath = config.modelPath;
          actualModelPath = adapterConfig.base_model_name_or_path;
          
          // Extract LoRA rank from adapter config (field name is 'r')
          if (typeof adapterConfig.r === 'number' && adapterConfig.r > 0) {
            loraRank = adapterConfig.r;
            console.log('[InferenceServerManager] Detected LoRA rank:', loraRank);
          }
          
          console.log('[InferenceServerManager] Detected LoRA adapter');
          console.log('[InferenceServerManager] Base model:', actualModelPath);
          console.log('[InferenceServerManager] Adapter path:', loraAdapterPath);
        }
      } catch (error) {
        // Not a LoRA adapter or file read failed - proceed with full model deployment
        console.log('[InferenceServerManager] No LoRA adapter detected, proceeding as full model');
      }

      // Build vLLM command arguments
      // vLLM v0.6.0+ uses: vllm serve <model> [options]
      // Must use the vllm CLI directly, not python -m vllm
      const args = [
        'serve',
        actualModelPath,  // Model path is positional argument after 'serve'
        '--port', port.toString(),
        '--host', '127.0.0.1', // Only accessible locally for security
        '--served-model-name', config.modelName,
        '--gpu-memory-utilization', String(config.gpuMemoryUtilization || 0.9),
        // Use 4-bit quantization to fit large models in VRAM
        '--quantization', 'bitsandbytes',
        '--load-format', 'bitsandbytes',
        // Add required flags for tool use
        '--enable-auto-tool-choice',
        '--tool-call-parser', 'hermes',
      ];

      // Add LoRA-specific flags if this is a LoRA adapter
      if (isLoraAdapter && loraAdapterPath) {
        args.push('--enable-lora');
        
        // Set max_lora_rank based on detected adapter rank
        // vLLM requires max_lora_rank to be one of: 8, 16, 32, 64, 128, 256, 320, 512
        if (loraRank !== null) {
          const validRanks = [8, 16, 32, 64, 128, 256, 320, 512];
          const maxLoraRank = validRanks.find(r => r >= loraRank) || 512;
          args.push('--max-lora-rank');
          args.push(String(maxLoraRank));
          console.log(`[InferenceServerManager] Setting max-lora-rank=${maxLoraRank} for adapter rank=${loraRank}`);
        } else {
          // Fallback to default if rank not detected (should not happen for valid adapters)
          console.warn('[InferenceServerManager] LoRA rank not detected, using vLLM default max-lora-rank=16');
        }
        
        args.push('--lora-modules');
        args.push(`${config.modelName}=${loraAdapterPath}`);
        console.log('[InferenceServerManager] LoRA adapter will be loaded:', loraAdapterPath);
      }

      // Optional arguments
      if (config.maxModelLen) {
        args.push('--max-model-len', String(config.maxModelLen));
      }

      if (config.tensorParallelSize && config.tensorParallelSize > 1) {
        args.push('--tensor-parallel-size', String(config.tensorParallelSize));
      }

      if (config.dtype && config.dtype !== 'auto') {
        args.push('--dtype', config.dtype);
      }

      if (config.trustRemoteCode) {
        args.push('--trust-remote-code');
      }

      console.log('[InferenceServerManager] Spawning vLLM with args:', args.join(' '));

      // Resolve vLLM executable from the trainer virtual environment
      const venvPath = path.join(process.cwd(), 'lib', 'training', 'trainer_venv');
      const vllmPath = path.join(venvPath, 'bin', 'vllm');
      console.log('[InferenceServerManager] vLLM executable:', vllmPath);

      // Spawn vLLM process
      const vllmProcess: ChildProcess = spawn(vllmPath, args, {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout and stderr
      });

      const serverId = uuidv4();
      this.processes.set(serverId, vllmProcess);

      vllmProcess.on('error', (processError: Error) => {
        console.error(`[vLLM ${serverId}] Spawn error:`, processError.message);
      });

      // Stream logs for debugging
      vllmProcess.stdout?.on('data', (data: Buffer) => {
        console.log(`[vLLM ${serverId}] ${data.toString().trim()}`);
      });

      vllmProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        // vLLM logs to stderr, filter out noise
        if (output.includes('ERROR') || output.includes('CRITICAL')) {
          console.error(`[vLLM ${serverId}] ERROR: ${output}`);
        } else {
          console.log(`[vLLM ${serverId}] ${output}`);
        }
      });

      vllmProcess.on('exit', (code: number | null, signal: string | null) => {
        console.log(`[vLLM ${serverId}] Process exited with code ${code}, signal ${signal}`);
        this.processes.delete(serverId);
      });

      const baseUrl = `http://127.0.0.1:${port}`;

      // Create database record
      const { error: dbError } = await supabaseClient
        .from('local_inference_servers')
        .insert({
          id: serverId,
          user_id: userId,
          server_type: 'vllm',
          name: config.modelName,
          base_url: baseUrl,
          port: port,
          model_path: config.modelPath,
          model_name: config.modelName,
          training_job_id: trainingJobId || null,
          process_id: vllmProcess.pid || null,
          status: 'starting',
          config_json: {
            gpu_memory_utilization: config.gpuMemoryUtilization || 0.8,
            max_model_len: config.maxModelLen || null,
            tensor_parallel_size: config.tensorParallelSize || 1,
            dtype: config.dtype || 'auto',
            trust_remote_code: config.trustRemoteCode || false,
            is_lora_adapter: isLoraAdapter,
            lora_adapter_path: loraAdapterPath,
            base_model_path: isLoraAdapter ? actualModelPath : null,
          },
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (dbError) {
        console.error('[InferenceServerManager] Failed to create database record:', dbError);
        // Kill process if DB insert fails
        vllmProcess.kill('SIGTERM');
        throw new Error(`Database error: ${dbError.message}`);
      }

      console.log('[InferenceServerManager] Database record created:', serverId);

      // Wait for server to be healthy (background task)
      this.waitForHealthy(serverId, baseUrl, userId, supabaseClient).catch((err) => {
        console.error('[InferenceServerManager] Health check failed:', err);
      });

      return {
        serverId,
        baseUrl,
        port,
        pid: vllmProcess.pid || undefined,
        status: 'starting',
      };
    } catch (error) {
      console.error('[InferenceServerManager] Failed to start vLLM:', error);
      throw error;
    }
  }

  /**
   * Check if Ollama is installed on the system
   */
  private checkOllamaInstalled(): boolean {
    // On Vercel, execSync for system binaries won't work
    if (process.env.VERCEL) {
      return false;
    }

    try {
      execSync('which ollama', { encoding: 'utf-8', stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if Ollama server is running
   */
  private async checkOllamaRunning(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      console.log('[InferenceServerManager] Ollama not running');
      return false;
    }
  }

  /**
   * Start Ollama server if not running
   */
  private async ensureOllamaRunning(): Promise<void> {
    // On Vercel, cannot spawn Ollama - must use external server
    if (process.env.VERCEL) {
      const externalUrl = process.env.OLLAMA_BASE_URL;
      if (!externalUrl || externalUrl.includes('localhost')) {
        throw new Error(
          'Cannot spawn Ollama on Vercel serverless environment. ' +
          'Set OLLAMA_BASE_URL to point to an external Ollama server.'
        );
      }
      // External Ollama configured, check if it's running
      const isRunning = await this.checkOllamaRunning();
      if (!isRunning) {
        throw new Error(
          `External Ollama server at ${externalUrl} is not responding. ` +
          'Please ensure the server is running.'
        );
      }
      console.log('[InferenceServerManager] Using external Ollama server:', externalUrl);
      return;
    }

    // First check if Ollama is installed
    if (!this.checkOllamaInstalled()) {
      throw new Error(
        'Ollama is not installed on this system. ' +
        'Please install Ollama first:\n' +
        '  Linux/Mac: curl -fsSL https://ollama.com/install.sh | sh\n' +
        '  Or visit: https://ollama.com/download'
      );
    }

    const isRunning = await this.checkOllamaRunning();

    if (isRunning) {
      console.log('[InferenceServerManager] Ollama already running');
      return;
    }

    console.log('[InferenceServerManager] Starting Ollama server...');

    try {
      // Start Ollama in background
      const ollamaProcess = spawn('ollama', ['serve'], {
        detached: true,
        stdio: 'ignore',
      });

      ollamaProcess.unref(); // Allow process to run independently

      // Wait for server to be ready (max 10 seconds)
      for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (await this.checkOllamaRunning()) {
          console.log('[InferenceServerManager] Ollama server started successfully');
          return;
        }
      }

      throw new Error('Ollama server failed to start within 10 seconds');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to start Ollama: ${message}`);
    }
  }

  /**
   * Start Ollama server with trained model
   */
  async startOllama(
    config: OllamaConfig,
    userId: string | null,
    trainingJobId: string | undefined,
    supabaseClient: SupabaseClient
  ): Promise<ServerInfo> {
    console.log('[InferenceServerManager] Starting Ollama deployment:', config.modelName);

    try {
      // Step 1: Ensure Ollama server is running
      await this.ensureOllamaRunning();

      // Step 2: Convert model to GGUF if needed
      const modelPath = path.resolve(config.modelPath);
      const ggufPath = await this.convertToGGUF(modelPath, config.modelName);

      // Compute an Ollama-safe served name
      const servedName = sanitizeOllamaModelName(config.modelName);
      console.log('[InferenceServerManager] Ollama served name:', servedName);

      // Step 3: Generate Modelfile
      const modelfileContent = generateModelfile({
        ggufPath: ggufPath,
        modelName: config.modelName,
        parameters: {
          contextLength: config.contextLength || 4096,
          temperature: 0.7,
          topP: 0.9,
        },
      });

      const modelfilePath = path.join(
        path.dirname(ggufPath),
        'Modelfile'
      );
      await saveModelfile(modelfileContent, modelfilePath);

      // Step 4: Create Ollama model
      const createProcess = spawn('ollama', [
        'create',
        servedName,
        '-f',
        modelfilePath
      ]);

      createProcess.stdout?.on('data', (data: Buffer) => {
        console.log('[Ollama Create]', data.toString().trim());
      });

      createProcess.stderr?.on('data', (data: Buffer) => {
        console.error('[Ollama Create Error]', data.toString().trim());
      });

      await new Promise<void>((resolve, reject) => {
        createProcess.on('exit', (code: number | null) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Ollama create failed with code ${code}`));
          }
        });
      });

      console.log('[InferenceServerManager] Ollama model created:', servedName);

      // Step 5: Register in database (Ollama uses port 11434)
      const serverId = uuidv4();
      const baseUrl = ENDPOINTS.OLLAMA;

      const { error: dbError } = await supabaseClient
        .from('local_inference_servers')
        .insert({
          id: serverId,
          user_id: userId,
          server_type: 'ollama',
          name: config.modelName,
          base_url: baseUrl,
          port: PORTS.OLLAMA,
          model_path: ggufPath,
          model_name: servedName,
          training_job_id: trainingJobId || null,
          process_id: null, // Shared Ollama server
          status: 'running',
          config_json: {
            context_length: config.contextLength || 4096,
            original_model_path: config.modelPath,
            served_model_name: servedName,
          },
          started_at: new Date().toISOString(),
        });

      if (dbError) {
        console.error('[InferenceServerManager] Database error:', dbError);
        throw new Error(`Database error: ${dbError.message}`);
      }

      console.log('[InferenceServerManager] Ollama deployment complete');

      return {
        serverId,
        baseUrl,
        port: PORTS.OLLAMA,
        status: 'running',
      };
    } catch (error) {
      console.error('[InferenceServerManager] Ollama deployment failed:', error);
      throw error;
    }
  }

  /**
   * Convert HuggingFace model to GGUF format
   */
  private async convertToGGUF(
    modelPath: string,
    modelName: string
  ): Promise<string> {
    const ggufPath = path.join(
      path.dirname(modelPath),
      `${modelName}.gguf`
    );
    const fp16GgufPath = path.join(
      path.dirname(modelPath),
      `${modelName}.fp16.gguf`
    );

    // Check if already converted (either quantized or FP16)
    try {
      await fs.access(ggufPath);
      console.log('[InferenceServerManager] GGUF file already exists:', ggufPath);
      return ggufPath;
    } catch {
      // Try FP16 version
      try {
        await fs.access(fp16GgufPath);
        console.log('[InferenceServerManager] FP16 GGUF file already exists:', fp16GgufPath);
        return fp16GgufPath;
      } catch {
        // File doesn't exist, proceed with conversion
      }
    }

    console.log('[InferenceServerManager] Converting to GGUF:', modelPath);

    // Use trainer_venv Python which has llama-cpp-python installed
    const pythonPath = process.env.PYTHON_PATH ||
                      path.join(process.cwd(), 'lib', 'training', 'trainer_venv', 'bin', 'python3');
    const converterScript = path.join(
      process.cwd(),
      'lib',
      'training',
      'convert_to_gguf.py'
    );

    console.log('[InferenceServerManager] Using Python:', pythonPath);
    console.log('[InferenceServerManager] Using converter script:', converterScript);

    const convertProcess = spawn(pythonPath, [
      converterScript,
      modelPath,
      ggufPath,
      '--quantization', 'Q4_K_M', // Will fall back to FP16 if quantization tools unavailable
    ], {
      // Force UTF-8 so Python can print Unicode safely on Windows (avoids cp1252 errors)
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
    });

    let convertOutput = '';
    let convertError = '';
    convertProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      convertOutput += output;
      console.log('[GGUF Conversion]', output.trim());
    });

    convertProcess.stderr?.on('data', (data: Buffer) => {
      const err = data.toString();
      convertError += err;
      console.error('[GGUF Conversion Error]', err.trim());
    });

    await new Promise<void>((resolve, reject) => {
      convertProcess.on('exit', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          // Include tail of stderr/stdout to aid debugging without flooding logs
          const tail = (s?: string) => (s ? s.slice(-1500) : '');
          const errSummary = tail(convertError) || tail(convertOutput);
          reject(new Error(`GGUF conversion failed with code ${code}. Details: ${errSummary}`));
        }
      });
    });

    // Parse output to find actual GGUF path (might be .fp16.gguf if quantization unavailable)
    const successMatch = convertOutput.match(/SUCCESS: GGUF file created at (.+)/);
    const actualPath = successMatch ? successMatch[1].trim() : ggufPath;
    
    // Verify the file exists
    try {
      await fs.access(actualPath);
      console.log('[InferenceServerManager] GGUF conversion complete:', actualPath);
      return actualPath;
    } catch {
      // If parsed path doesn't exist, try fp16 version
      try {
        await fs.access(fp16GgufPath);
        console.log('[InferenceServerManager] Using FP16 GGUF:', fp16GgufPath);
        return fp16GgufPath;
      } catch {
        console.log('[InferenceServerManager] GGUF conversion complete (expected path):', ggufPath);
        return ggufPath;
      }
    }
  }

  /**
   * Stop a running server
   */
  async stopServer(serverId: string, userId: string | null): Promise<void> {
    console.log('[InferenceServerManager] Stopping server:', serverId);

    // First, try to get process from memory
    const memoryProcess = this.processes.get(serverId);

    // Also get the PID from database as fallback (critical for server restarts)
    const serverInfo = await this.getServerStatus(serverId, userId);
    const pid = serverInfo?.pid || memoryProcess?.pid;

    if (!memoryProcess && !pid) {
      console.warn('[InferenceServerManager] No process found in memory or database');
      // Update database anyway
      await this.updateServerStatus(serverId, userId, 'stopped');
      return;
    }

    // If we have a PID (from DB or memory), try to kill it
    if (pid) {
      try {
        console.log('[InferenceServerManager] Attempting to kill process group:', pid);

        // Kill the entire process group (negative PID) to ensure child processes are terminated
        // This is critical for VLLM which spawns VLLM::EngineCore child process that holds VRAM
        try {
          // Try graceful shutdown first (SIGTERM to process group)
          process.kill(-pid, 'SIGTERM');
        } catch (error) {
          // Process group kill failed, try individual process
          console.warn('[InferenceServerManager] Process group kill failed, trying individual process');
          process.kill(pid, 'SIGTERM');
        }

        // Wait up to 5 seconds for graceful shutdown
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            try {
              // Check if still alive
              process.kill(pid, 0);
              // Still alive, force kill entire process group
              console.warn('[InferenceServerManager] Force killing process group:', pid);
              try {
                process.kill(-pid, 'SIGKILL');
              } catch {
                // Fallback to individual process
                process.kill(pid, 'SIGKILL');
              }
            } catch {
              // Process already dead
              console.log('[InferenceServerManager] Process already terminated');
            }
            resolve();
          }, 5000);

          // Set up interval to check if process died
          const checkInterval = setInterval(() => {
            try {
              process.kill(pid, 0); // Check if alive
            } catch {
              // Process is dead
              clearTimeout(timeout);
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });

        console.log('[InferenceServerManager] Process group killed successfully');
      } catch (error) {
        // Process might already be dead, or we don't have permission
        console.warn('[InferenceServerManager] Kill failed (process may already be dead):', error);
      }
    }

    // If we had it in memory, remove it
    if (memoryProcess) {
      this.processes.delete(serverId);
    }

    // Update database
    await this.updateServerStatus(serverId, userId, 'stopped', new Date().toISOString());
  }

  /**
   * Clean up zombie processes - servers marked as running but process is dead
   * This is critical after server restarts where in-memory process map is cleared
   */
  async cleanupZombieProcesses(userId: string | null = null): Promise<void> {
    console.log('[InferenceServerManager] Checking for zombie processes...');

    try {
      // Get all "running" servers for this user (or all if userId is null)
      let query = supabase
        .from('local_inference_servers')
        .select('*')
        .eq('status', 'running');

      if (userId) {
        query = query.eq('user_id', userId);
      } else {
        query = query.is('user_id', null);
      }

      const { data: servers, error } = await query;

      if (error) {
        console.error('[InferenceServerManager] Error fetching servers for cleanup:', error);
        return;
      }

      if (!servers || servers.length === 0) {
        console.log('[InferenceServerManager] No running servers found');
        return;
      }

      console.log('[InferenceServerManager] Found', servers.length, 'running servers, checking PIDs...');

      let cleanedCount = 0;
      for (const server of servers) {
        if (!server.process_id) {
          // No PID stored, mark as stopped
          console.log('[InferenceServerManager] Server has no PID, marking as stopped:', server.id);
          await this.updateServerStatus(server.id, userId, 'stopped');
          cleanedCount++;
          continue;
        }

        try {
          // Check if process is actually alive (signal 0 = check existence without killing)
          process.kill(server.process_id, 0);
          console.log('[InferenceServerManager] Process still alive:', server.process_id, '(server:', server.name, ')');
        } catch {
          // Process is dead, update database
          console.log('[InferenceServerManager] Zombie process found:', server.process_id, '(server:', server.name, ') - cleaning up');
          await this.updateServerStatus(server.id, userId, 'stopped');
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log('[InferenceServerManager] Cleaned up', cleanedCount, 'zombie processes');
      } else {
        console.log('[InferenceServerManager] No zombie processes found');
      }
    } catch (error) {
      console.error('[InferenceServerManager] Error during zombie cleanup:', error);
    }
  }

  /**
   * Get server status
   */
  async getServerStatus(
    serverId: string,
    userId: string | null,
    supabaseClient?: SupabaseClient
  ): Promise<ServerInfo | null> {
    // Use provided client or fall back to static client
    const client = supabaseClient || supabase;

    // Build query with proper NULL handling
    let query = client
      .from('local_inference_servers')
      .select('*')
      .eq('id', serverId);
    
    if (userId === null) {
      query = query.is('user_id', null);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      console.error('[InferenceServerManager] Failed to get server status:', error);
      return null;
    }

    return {
      serverId: data.id,
      baseUrl: data.base_url,
      port: data.port,
      pid: data.process_id || undefined,
      status: data.status as 'starting' | 'running' | 'error',
      errorMessage: data.error_message || undefined,
    };
  }

  /**
   * Find available port in specified range
   */
  private async findAvailablePort(
    start: number,
    end: number,
    userId: string | null,
    supabaseClient: SupabaseClient
  ): Promise<number> {
    console.log('[InferenceServerManager] Finding available port in range:', start, '-', end);

    // Check database for ports in use by running servers
    let query = supabaseClient
      .from('local_inference_servers')
      .select('port')
      .eq('status', 'running');
    
    // Handle null userId - use .is() instead of .eq() for NULL values
    if (userId === null) {
      query = query.is('user_id', null);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data: servers, error } = await query;

    if (error) {
      console.error('[InferenceServerManager] Failed to query ports:', error);
      throw new Error(`Failed to query ports: ${error.message}`);
    }

    const usedPorts = new Set(servers?.map((s) => s.port) || []);
    console.log('[InferenceServerManager] Ports in use:', Array.from(usedPorts));

    // Find first available port
    for (let port = start; port <= end; port++) {
      if (!usedPorts.has(port)) {
        // Double-check port is actually available on the system
        const available = await this.checkPortAvailable(port);
        if (available) {
          console.log('[InferenceServerManager] Found available port:', port);
          return port;
        }
      }
    }

    throw new Error(`No available ports in range ${start}-${end}`);
  }

  /**
   * Check if a port is actually available on the system
   */
  private async checkPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', () => {
        resolve(false);
      });

      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * Wait for server to be healthy (background task)
   */
  private async waitForHealthy(
    serverId: string,
    baseUrl: string,
    userId: string | null,
    supabaseClient: SupabaseClient,
    maxWaitMs: number = 120000 // 2 minutes
  ): Promise<void> {
    console.log('[InferenceServerManager] Waiting for server to be healthy:', baseUrl);

    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      try {
        // Try health check endpoint
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${baseUrl}/health`, {
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          console.log('[InferenceServerManager] Server is healthy:', baseUrl);
          await this.updateServerStatus(serverId, userId, 'running', undefined, undefined, supabaseClient);
          await this.updateHealthCheck(serverId, userId, supabaseClient);
          return;
        }
      } catch {
        // Server not ready yet, continue waiting
      }

      // Wait 2 seconds before next attempt
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Timeout reached
    console.error('[InferenceServerManager] Health check timeout:', baseUrl);
    await this.updateServerStatus(
      serverId,
      userId,
      'error',
      undefined,
      'Server failed to start within 2 minutes',
      supabaseClient
    );

    // Kill the process
    const process = this.processes.get(serverId);
    if (process) {
      process.kill('SIGKILL');
      this.processes.delete(serverId);
    }
  }

  /**
   * Update server status in database
   */
  private async updateServerStatus(
    serverId: string,
    userId: string | null,
    status: ServerStatus,
    stoppedAt?: string,
    errorMessage?: string,
    supabaseClient?: SupabaseClient
  ): Promise<void> {
    const client = supabaseClient || supabase;
    const updates: ServerUpdatePayload = { status };

    if (stoppedAt) {
      updates.stopped_at = stoppedAt;
    }

    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    let query = client
      .from('local_inference_servers')
      .update(updates)
      .eq('id', serverId);
    
    if (userId === null) {
      query = query.is('user_id', null);
    } else {
      query = query.eq('user_id', userId);
    }

    const { error } = await query;

    if (error) {
      console.error('[InferenceServerManager] Failed to update server status:', error);
    } else {
      console.log('[InferenceServerManager] Server status updated:', serverId, status);
    }
  }

  /**
   * Update last health check timestamp
   */
  private async updateHealthCheck(
    serverId: string,
    userId: string | null,
    supabaseClient?: SupabaseClient
  ): Promise<void> {
    const client = supabaseClient || supabase;

    let query = client
      .from('local_inference_servers')
      .update({ last_health_check: new Date().toISOString() })
      .eq('id', serverId);
    
    if (userId === null) {
      query = query.is('user_id', null);
    } else {
      query = query.eq('user_id', userId);
    }

    const { error } = await query;

    if (error) {
      console.error('[InferenceServerManager] Failed to update health check:', error);
    }
  }

  // Docker-based helpers removed: vLLM deployments now rely solely on native linux processes.

  /**
   * Start Simple Inference Server (Python FastAPI, no Docker)
   * Direct LoRA adapter loading for quick testing
   */
  async startSimpleServer(
    modelPath: string,
    modelName: string,
    userId: string | null,
    trainingJobId: string | undefined,
    supabaseClient: SupabaseClient,
    baseModel: string = 'Qwen/Qwen2.5-0.5B'
  ): Promise<ServerInfo> {
    console.log('[InferenceServerManager] Starting Simple Inference Server');
    console.log('[InferenceServerManager] Adapter path:', modelPath);
    console.log('[InferenceServerManager] Base model:', baseModel);

    try {
      // Find available port
      const port = await this.findAvailablePort(8002, 8020, userId, supabaseClient);
      console.log('[InferenceServerManager] Allocated port:', port);

      // Get Python executable from training environment
      const pythonPath = process.env.VLLM_PYTHON_PATH ||
                        process.env.PYTHON_PATH ||
                        path.join(process.cwd(), 'lib', 'training', 'trainer_venv', 'bin', 'python3');

      console.log('[InferenceServerManager] Using Python:', pythonPath);

      // Path to simple inference server
      const serverScript = path.join(process.cwd(), 'lib', 'inference', 'simple_inference_server.py');
      
      // Check if script exists
      if (!fsSync.existsSync(serverScript)) {
        throw new Error(`Simple inference server script not found: ${serverScript}`);
      }

      // Spawn Python server
      const serverProcess: ChildProcess = spawn(
        pythonPath,
        [
          '-m', 'uvicorn',
          'lib.inference.simple_inference_server:app',
          '--host', '127.0.0.1',
          '--port', port.toString(),
          '--log-level', 'info'
        ],
        {
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: process.cwd()
        }
      );

      const serverId = uuidv4();
      this.processes.set(serverId, serverProcess);

      // Stream logs
      serverProcess.stdout?.on('data', (data: Buffer) => {
        console.log(`[SimpleServer ${serverId}] ${data.toString().trim()}`);
      });

      serverProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        if (output.includes('ERROR') || output.includes('CRITICAL')) {
          console.error(`[SimpleServer ${serverId}] ERROR: ${output}`);
        } else {
          console.log(`[SimpleServer ${serverId}] ${output}`);
        }
      });

      serverProcess.on('exit', (code: number | null, signal: string | null) => {
        console.log(`[SimpleServer ${serverId}] Process exited with code ${code}, signal ${signal}`);
        this.processes.delete(serverId);
      });

      const baseUrl = `http://127.0.0.1:${port}`;

      // Create database record
      const { error: dbError } = await supabaseClient
        .from('local_inference_servers')
        .insert({
          id: serverId,
          user_id: userId,
          server_type: 'simple',
          name: modelName,
          base_url: baseUrl,
          port: port,
          model_path: modelPath,
          model_name: modelName,
          training_job_id: trainingJobId || null,
          process_id: serverProcess.pid || null,
          status: 'starting',
          config_json: {
            base_model: baseModel,
            adapter_path: modelPath,
            server_type: 'simple_inference'
          },
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (dbError) {
        console.error('[InferenceServerManager] Failed to create database record:', dbError);
        serverProcess.kill('SIGTERM');
        throw new Error(`Database error: ${dbError.message}`);
      }

      console.log('[InferenceServerManager] Database record created:', serverId);

      // Wait for server to be healthy
      console.log('[InferenceServerManager] Waiting for server to be ready...');
      await this.waitForSimpleServerHealthy(baseUrl, modelPath, baseModel);

      console.log('[InferenceServerManager] ✅ Simple server ready!');

      return {
        serverId,
        baseUrl,
        port,
        pid: serverProcess.pid || undefined,
        status: 'running',
      };
    } catch (error) {
      console.error('[InferenceServerManager] Failed to start simple server:', error);
      throw error;
    }
  }

  /**
   * Wait for simple server to be healthy and load adapter
   */
  private async waitForSimpleServerHealthy(
    baseUrl: string,
    adapterPath: string,
    baseModel: string,
    maxWaitMs: number = 60000
  ): Promise<void> {
    const startTime = Date.now();
    
    // Wait for server to start
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const response = await fetch(`${baseUrl}/`);
        if (response.ok) {
          console.log('[InferenceServerManager] Server is up, loading adapter...');
          break;
        }
      } catch {
        // Server not ready yet
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Load adapter
    try {
      console.log('[InferenceServerManager] Loading adapter:', adapterPath);
      const loadResponse = await fetch(`${baseUrl}/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adapter_path: adapterPath,
          base_model: baseModel
        })
      });

      if (!loadResponse.ok) {
        const error = await loadResponse.json();
        throw new Error(`Failed to load adapter: ${error.detail || 'Unknown error'}`);
      }

      const result = await loadResponse.json();
      console.log('[InferenceServerManager] Adapter loaded:', result.message);

      // Final health check
      const healthResponse = await fetch(`${baseUrl}/health`);
      if (!healthResponse.ok) {
        throw new Error('Server health check failed after adapter load');
      }

      console.log('[InferenceServerManager] Server is healthy and ready!');
    } catch (error) {
      console.error('[InferenceServerManager] Failed to load adapter:', error);
      throw error;
    }
  }
}

// Singleton instance
export const inferenceServerManager = new InferenceServerManager();

console.log('[InferenceServerManager] Service loaded');
