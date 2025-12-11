import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * @swagger
 * /api/batch-testing/status/{id}:
 *   get:
 *     summary: Get batch test status
 *     description: |
 *       Check the status of a running or completed batch test.
 *
 *       Returns real-time progress information including:
 *       - Total, completed, and failed prompts
 *       - Current execution stage
 *       - Estimated time remaining
 *       - Preliminary results (if available)
 *
 *       **Use Cases:**
 *       - Poll for test completion
 *       - Monitor long-running tests
 *       - Display progress in your UI
 *       - Track test execution in real-time
 *     tags:
 *       - Batch Testing
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Batch test run ID (returned from /api/batch-testing/run)
 *         example: "test_xyz789"
 *     responses:
 *       200:
 *         description: Status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 test_id:
 *                   type: string
 *                   example: "test_xyz789"
 *                 status:
 *                   type: string
 *                   enum: [pending, running, completed, failed, cancelled]
 *                   example: "running"
 *                 progress:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 100
 *                     completed:
 *                       type: integer
 *                       example: 67
 *                     failed:
 *                       type: integer
 *                       example: 3
 *                     percentage:
 *                       type: number
 *                       example: 67.0
 *                 estimated_time_remaining_ms:
 *                   type: integer
 *                   description: Estimated milliseconds until completion
 *                   example: 45000
 *                 preliminary_results:
 *                   type: object
 *                   description: Partial results (only if test is running/completed)
 *                   properties:
 *                     avg_latency_ms:
 *                       type: number
 *                       example: 1234.56
 *                     success_rate:
 *                       type: number
 *                       example: 0.96
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Test run not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const startTime = Date.now();
  console.log('[Batch Testing Status] Request received:', {
    testRunId: id,
    timestamp: new Date().toISOString()
  });

  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('[Batch Testing Status] Missing authorization header');
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Batch Testing Status] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Authentication failed', details: authError?.message },
        { status: 401 }
      );
    }

    console.log('[Batch Testing Status] User authenticated:', {
      userId: user.id,
      testRunId: id
    });

    // Query batch test run from database
    const { data: batchTestRun, error: queryError } = await supabase
      .from('batch_test_runs')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (queryError || !batchTestRun) {
      console.error('[Batch Testing Status] Batch test run not found:', {
        testRunId: id,
        userId: user.id,
        error: queryError
      });
      return NextResponse.json(
        { error: 'Batch test run not found', details: queryError?.message },
        { status: 404 }
      );
    }

    console.log('[Batch Testing Status] Batch test run found:', {
      testRunId: batchTestRun.id,
      status: batchTestRun.status,
      totalPrompts: batchTestRun.total_prompts,
      completedPrompts: batchTestRun.completed_prompts
    });

    // Calculate progress percentage
    const progress = batchTestRun.total_prompts > 0
      ? batchTestRun.completed_prompts / batchTestRun.total_prompts
      : 0;

    // Build response
    const response = {
      id: batchTestRun.id,
      status: batchTestRun.status,
      model_name: batchTestRun.model_name,
      total_prompts: batchTestRun.total_prompts,
      completed_prompts: batchTestRun.completed_prompts,
      failed_prompts: batchTestRun.failed_prompts,
      progress: Math.round(progress * 100) / 100,
      started_at: batchTestRun.started_at,
      completed_at: batchTestRun.completed_at,
      error: batchTestRun.error
    };

    const elapsedTime = Date.now() - startTime;
    console.log('[Batch Testing Status] Response prepared:', {
      testRunId: id,
      status: response.status,
      progress: response.progress,
      elapsedMs: elapsedTime
    });

    return NextResponse.json(response);

  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    console.error('[Batch Testing Status] Error occurred:', {
      testRunId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      elapsedMs: elapsedTime
    });

    return NextResponse.json(
      {
        error: 'Failed to get batch test status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
