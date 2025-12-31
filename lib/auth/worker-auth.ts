/**
 * Worker Authentication Module
 * Provides HMAC-based authentication for distributed worker endpoints
 * AND API key-based authentication for downloadable worker agents
 * Date: 2025-12-18
 * Updated: 2025-12-26 - Added worker agent API key authentication
 */

import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { validateApiKey } from './api-key-validator';

const SIGNATURE_HEADER = 'x-worker-signature';
const WORKER_ID_HEADER = 'x-worker-id';
const TIMESTAMP_HEADER = 'x-worker-timestamp';
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export type WorkerAuthResult =
  | { ok: true; workerId: string }
  | { ok: false; status: number; error: string };

/**
 * Authenticates a worker request using HMAC signature
 * @param req - NextRequest object
 * @returns Authentication result with worker ID
 */
export async function authenticateWorker(req: NextRequest): Promise<WorkerAuthResult> {
  const workerSecret = process.env.DISTRIBUTED_WORKER_SECRET;

  if (!workerSecret) {
    console.error('[Worker Auth] Missing DISTRIBUTED_WORKER_SECRET environment variable');
    return { ok: false, status: 500, error: 'Server configuration error' };
  }

  // Extract headers
  const workerId = req.headers.get(WORKER_ID_HEADER);
  const timestamp = req.headers.get(TIMESTAMP_HEADER);
  const signature = req.headers.get(SIGNATURE_HEADER);

  // Validate required headers
  if (!workerId) {
    console.log('[Worker Auth] Missing worker ID header');
    return { ok: false, status: 401, error: 'Missing worker ID' };
  }

  if (!timestamp) {
    console.log('[Worker Auth] Missing timestamp header');
    return { ok: false, status: 401, error: 'Missing timestamp' };
  }

  if (!signature) {
    console.log('[Worker Auth] Missing signature header');
    return { ok: false, status: 401, error: 'Missing signature' };
  }

  // Validate timestamp format and freshness
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum)) {
    console.log('[Worker Auth] Invalid timestamp format');
    return { ok: false, status: 401, error: 'Invalid timestamp format' };
  }

  const now = Date.now();
  const timeDiff = Math.abs(now - timestampNum);

  if (timeDiff > TIMESTAMP_WINDOW_MS) {
    console.log('[Worker Auth] Timestamp outside valid window:', { timeDiff, window: TIMESTAMP_WINDOW_MS });
    return { ok: false, status: 401, error: 'Timestamp expired or too far in future' };
  }

  // Generate expected signature
  const expectedSignature = generateWorkerSignature(workerId, timestampNum, workerSecret);

  // Constant-time comparison to prevent timing attacks
  const isValid = validateWorkerSignature(workerId, timestampNum, signature, workerSecret);

  if (!isValid) {
    console.log('[Worker Auth] Invalid signature for worker:', workerId);
    return { ok: false, status: 401, error: 'Invalid signature' };
  }

  console.log('[Worker Auth] Authentication successful for worker:', workerId);
  return { ok: true, workerId };
}

/**
 * Generates HMAC signature for worker authentication
 * @param workerId - Worker identifier
 * @param timestamp - Unix timestamp in milliseconds
 * @param secret - Shared secret key
 * @returns HMAC-SHA256 signature as hex string
 */
export function generateWorkerSignature(workerId: string, timestamp: number, secret: string): string {
  const message = `${workerId}:${timestamp}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(message);
  return hmac.digest('hex');
}

/**
 * Validates worker signature using constant-time comparison
 * @param workerId - Worker identifier
 * @param timestamp - Unix timestamp in milliseconds
 * @param signature - Provided signature to validate
 * @param secret - Shared secret key
 * @returns True if signature is valid
 */
export function validateWorkerSignature(
  workerId: string,
  timestamp: number,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateWorkerSignature(workerId, timestamp, secret);

  // Convert to buffers for constant-time comparison
  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const providedBuffer = Buffer.from(signature, 'hex');

    // Buffers must be same length for timingSafeEqual
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  } catch (error) {
    console.error('[Worker Auth] Error comparing signatures:', error);
    return false;
  }
}

// ============================================================================
// Worker Agent API Key Authentication (for downloadable agents)
// ============================================================================

export type WorkerApiKeyAuthResult =
  | { ok: true; userId: string; workerId: string; keyId: string }
  | { ok: false; status: number; error: string };

/**
 * Authenticates a worker agent using API key with worker scope
 * Used for downloadable worker agents (Windows/macOS)
 * @param req - NextRequest object with X-API-Key header
 * @returns Authentication result with user ID and worker ID
 */
export async function authenticateWorkerApiKey(
  req: NextRequest
): Promise<WorkerApiKeyAuthResult> {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');

  if (!apiKey) {
    console.log('[Worker API Key Auth] Missing API key');
    return { ok: false, status: 401, error: 'Missing API key' };
  }

  // Validate format (worker API keys start with wak_)
  if (!apiKey.startsWith('wak_')) {
    console.log('[Worker API Key Auth] Invalid API key format');
    return { ok: false, status: 401, error: 'Invalid API key format' };
  }

  // Get Supabase client with service role
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Worker API Key Auth] Missing Supabase environment variables');
    return { ok: false, status: 500, error: 'Server configuration error' };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Validate API key using proper hash verification
  console.log('[Worker API Key Auth] Validating API key');
  const validation = await validateApiKey(apiKey);

  if (!validation.isValid || !validation.userId || !validation.keyId) {
    console.log('[Worker API Key Auth] Invalid API key');
    return { ok: false, status: 401, error: 'Invalid or inactive API key' };
  }

  // Check worker scope
  const scopes = validation.scopes || [];
  if (!scopes.includes('worker') && !scopes.includes('all')) {
    console.log('[Worker API Key Auth] API key missing worker scope');
    return { ok: false, status: 403, error: 'API key does not have worker scope' };
  }

  // Fetch worker_id from the API key record
  const { data: keyData, error: keyError } = await supabase
    .from('user_api_keys')
    .select('worker_id')
    .eq('id', validation.keyId)
    .single();

  if (keyError || !keyData) {
    console.error('[Worker API Key Auth] Failed to fetch API key data:', keyError);
    return { ok: false, status: 500, error: 'Failed to fetch API key data' };
  }

  // Validate worker_id
  if (!keyData.worker_id) {
    console.log('[Worker API Key Auth] API key missing worker_id');
    return { ok: false, status: 400, error: 'API key not associated with a worker' };
  }

  // Update last_used_at asynchronously (fire and forget)
  supabase.rpc('update_api_key_usage', { p_key_id: validation.keyId }).then(({ error: updateError }) => {
    if (updateError) {
      console.warn('[Worker API Key Auth] Failed to update usage:', updateError);
    }
  });

  console.log('[Worker API Key Auth] Authentication successful:', {
    userId: validation.userId,
    workerId: keyData.worker_id,
  });

  return {
    ok: true,
    userId: validation.userId,
    workerId: keyData.worker_id,
    keyId: validation.keyId,
  };
}

/**
 * Generates HMAC signature for commands sent to workers
 * Workers verify this signature before executing commands
 * @param commandId - Unique command ID
 * @param commandType - Type of command (start_trading, stop_trading, etc.)
 * @param timestamp - Unix timestamp in milliseconds
 * @param secret - Worker's API key (used as secret)
 * @returns HMAC-SHA256 signature as hex string
 */
export function generateCommandSignature(
  commandId: string,
  commandType: string,
  timestamp: number,
  secret: string
): string {
  const message = `${commandId}:${commandType}:${timestamp}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(message);
  return hmac.digest('hex');
}

/**
 * Verifies command signature using constant-time comparison
 * Called by worker agents before executing commands
 * @param commandId - Unique command ID
 * @param commandType - Type of command
 * @param timestamp - Unix timestamp in milliseconds
 * @param signature - Provided signature to validate
 * @param secret - Worker's API key (used as secret)
 * @returns True if signature is valid
 */
export function verifyCommandSignature(
  commandId: string,
  commandType: string,
  timestamp: number,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateCommandSignature(commandId, commandType, timestamp, secret);

  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const providedBuffer = Buffer.from(signature, 'hex');

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  } catch (error) {
    console.error('[Worker Auth] Error verifying command signature:', error);
    return false;
  }
}

