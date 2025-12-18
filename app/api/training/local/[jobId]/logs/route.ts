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
      .select('id, user_id')
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
    console.log('[LocalTraining Logs] Retrieved', data.logs?.length || 0, 'log lines');

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
