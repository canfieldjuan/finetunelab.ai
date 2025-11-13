import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/batch-testing/status/[id]
 *
 * Get the status of a batch test run.
 * Returns progress information including total/completed/failed prompts.
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
