/**
 * @swagger
 * /api/training/local/{jobId}/logs:
 *   get:
 *     summary: Get training logs
 *     description: |
 *       Stream training logs in real-time with pagination support.
 *
 *       Access the raw console output from your training job, including:
 *       - Model initialization logs
 *       - Training progress messages
 *       - Warning and error messages
 *       - Debug output
 *       - Checkpoint save notifications
 *
 *       **Use Cases:**
 *       - Debug training failures
 *       - Monitor training progress in detail
 *       - Tail logs in real-time
 *       - Export logs for troubleshooting
 *       - Build log viewers in your application
 *
 *       **Pagination:**
 *       - Use `limit` and `offset` to paginate through large log files
 *       - Default limit: 100 lines
 *       - Logs are returned in chronological order
 *     tags:
 *       - Metrics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Training job ID
 *         example: "job_abc123"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of log lines to return
 *         example: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Line offset to start from (for pagination)
 *         example: 0
 *     responses:
 *       200:
 *         description: Logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   description: Array of log lines
 *                   items:
 *                     type: string
 *                   example:
 *                     - "[2024-11-15 10:23:45] Loading model meta-llama/Llama-2-7b-hf..."
 *                     - "[2024-11-15 10:24:12] Model loaded successfully"
 *                     - "[2024-11-15 10:24:15] Starting training..."
 *                     - "[2024-11-15 10:24:30] Step 1/1000 | Loss: 2.456"
 *                 total_lines:
 *                   type: integer
 *                   description: Total number of log lines available
 *                   example: 1523
 *                 offset:
 *                   type: integer
 *                   description: Current offset
 *                   example: 0
 *                 limit:
 *                   type: integer
 *                   description: Current limit
 *                   example: 100
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       503:
 *         description: Training server unavailable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to connect to local training server"
 *                 details:
 *                   type: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateRequestWithScope } from '@/lib/auth/api-key-validator';

export const runtime = 'nodejs';

const TRAINING_SERVER_URL = process.env.TRAINING_SERVER_URL || 'http://localhost:8000';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get('limit') || process.env.TRAINING_LOGS_DEFAULT_LIMIT || '100';
  const offset = searchParams.get('offset') || '0';

  console.log('[LocalTraining Logs] GET logs for job:', jobId, { limit, offset });

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials' },
      { status: 500 }
    );
  }

  try {
    let userId: string | null = null;

    const apiKeyValidation = await validateRequestWithScope(request.headers, 'training');

    if (apiKeyValidation.isValid && apiKeyValidation.userId) {
      userId = apiKeyValidation.userId;
    } else {
      const authHeader = request.headers.get('authorization');
      if (!authHeader) {
        return NextResponse.json(
          { error: 'Unauthorized: Missing authentication' },
          { status: 401 }
        );
      }

      if (!supabaseAnonKey) {
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        );
      }

      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

      if (authError || !user) {
        console.error('[LocalTraining Logs] Auth error:', authError);
        return NextResponse.json(
          { error: 'Unauthorized: Invalid token' },
          { status: 401 }
        );
      }

      userId = user.id;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('id, user_id, metadata')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (jobError || !job) {
      console.error('[LocalTraining Logs] Job not found or unauthorized:', jobError);
      return NextResponse.json(
        { error: 'Job not found or unauthorized' },
        { status: 404 }
      );
    }

    // Try to get logs from database metadata first (new storage location)
    const metadata = job.metadata || {};
    const storedLogs: string[] = metadata.logs || [];

    if (storedLogs.length > 0) {
      // Logs are stored in database, return them with pagination
      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset);
      const paginatedLogs = storedLogs.slice(offsetNum, offsetNum + limitNum);

      console.log('[LocalTraining Logs] Retrieved', paginatedLogs.length, 'log lines from database. Total:', storedLogs.length);

      return NextResponse.json({
        logs: paginatedLogs,
        total_lines: storedLogs.length,
        offset: offsetNum,
        limit: limitNum
      });
    }

    // Fallback: Try to fetch from training server (old proxy pattern)
    console.log('[LocalTraining Logs] No logs in database, trying training server');
    const url = `${TRAINING_SERVER_URL}/api/training/logs/${jobId}?limit=${limit}&offset=${offset}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[LocalTraining Logs] Error from training server:', errorData);

      return NextResponse.json(
        { error: errorData.error || `Training server error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[LocalTraining Logs] Retrieved', data.logs?.length || 0, 'log lines from training server');

    return NextResponse.json(data);

  } catch (error) {
    console.error('[LocalTraining Logs] Failed to connect to training server:', error);
    return NextResponse.json(
      {
        error: 'Failed to connect to local training server',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}

/**
 * POST /api/training/local/{jobId}/logs
 * Receive training logs from Python worker
 *
 * Request body:
 * {
 *   logs: string[]  // Array of log lines to append
 * }
 *
 * Authentication: Bearer token (job_token)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  console.log('[LocalTraining Logs POST] Receiving logs for job:', jobId);

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials' },
      { status: 500 }
    );
  }

  try {
    // Extract and validate job_token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[LocalTraining Logs POST] Missing or invalid authorization header');
      return NextResponse.json(
        { error: 'Unauthorized: Bearer token required' },
        { status: 401 }
      );
    }

    const jobToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Parse request body
    const body = await request.json();
    const { logs } = body;

    // Validate logs
    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json(
        { error: 'Invalid request: logs must be an array' },
        { status: 400 }
      );
    }

    if (logs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No logs to append'
      });
    }

    // Validate log entries are strings
    if (!logs.every(log => typeof log === 'string')) {
      return NextResponse.json(
        { error: 'Invalid request: all log entries must be strings' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify job exists and token matches
    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('id, job_token, metadata')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('[LocalTraining Logs POST] Job not found:', jobId);
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.job_token !== jobToken) {
      console.error('[LocalTraining Logs POST] Invalid job token');
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    // Get existing logs from metadata or create new array
    const existingMetadata = job.metadata || {};
    const existingLogs: string[] = existingMetadata.logs || [];

    // Append new logs
    const updatedLogs = [...existingLogs, ...logs];

    // Limit total logs to prevent database bloat (keep last 10,000 lines)
    const MAX_LOG_LINES = 10000;
    const finalLogs = updatedLogs.length > MAX_LOG_LINES
      ? updatedLogs.slice(-MAX_LOG_LINES)
      : updatedLogs;

    // Update metadata with new logs
    const updatedMetadata = {
      ...existingMetadata,
      logs: finalLogs,
      last_log_update: new Date().toISOString()
    };

    // Update job with new logs
    const { error: updateError } = await supabase
      .from('local_training_jobs')
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('[LocalTraining Logs POST] Failed to update logs:', updateError);
      return NextResponse.json(
        { error: 'Failed to store logs', details: updateError.message },
        { status: 500 }
      );
    }

    console.log('[LocalTraining Logs POST] Successfully appended', logs.length, 'log lines. Total:', finalLogs.length);

    return NextResponse.json({
      success: true,
      logs_appended: logs.length,
      total_logs: finalLogs.length
    });

  } catch (error) {
    console.error('[LocalTraining Logs POST] Request error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
