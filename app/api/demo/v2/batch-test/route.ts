/**
 * Demo V2 Batch Test API
 * POST /api/demo/v2/batch-test - Start a batch test for a demo session
 * GET /api/demo/v2/batch-test?session_id=xxx - Get batch test status and results
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptApiKey } from '@/lib/demo/encryption';
import { callDemoModelSimple, type DemoModelEndpoint } from '@/lib/demo/openai-compatible-caller';
import type { DemoTestSuite, DemoBatchTestStatus } from '@/lib/demo/types';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Default batch test configuration
const DEFAULT_PROMPT_LIMIT = 10;
const DEFAULT_DELAY_MS = 500; // Delay between prompts to avoid rate limiting

/**
 * POST /api/demo/v2/batch-test
 * Start a new batch test
 */
export async function POST(req: NextRequest) {
  try {
    const { session_id, test_suite_id, prompt_limit, concurrency } = await req.json();

    if (!session_id || !test_suite_id) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, test_suite_id' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get session config
    const { data: config, error: configError } = await supabase
      .from('demo_model_configs')
      .select('*')
      .eq('session_id', session_id)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if expired
    if (new Date(config.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 410 }
      );
    }

    // Check if connection was tested
    if (!config.connection_tested) {
      return NextResponse.json(
        { error: 'Please test connection before running batch test' },
        { status: 400 }
      );
    }

    // Get test suite
    const { data: testSuite, error: suiteError } = await supabase
      .from('demo_test_suites')
      .select('*')
      .eq('id', test_suite_id)
      .single();

    if (suiteError || !testSuite) {
      return NextResponse.json(
        { error: 'Test suite not found' },
        { status: 404 }
      );
    }

    const suite = testSuite as DemoTestSuite;

    // Get prompts (limit to configured amount)
    const limit = Math.min(prompt_limit || DEFAULT_PROMPT_LIMIT, suite.prompts.length);
    const prompts = suite.prompts.slice(0, limit);

    // Create batch test run record
    const { data: testRun, error: runError } = await supabase
      .from('demo_batch_test_runs')
      .insert({
        demo_user_id: 'demo-user',
        demo_session_id: session_id,
        model_name: config.model_name || config.model_id,
        status: 'running' as DemoBatchTestStatus,
        total_prompts: prompts.length,
        completed_prompts: 0,
        failed_prompts: 0,
        config: {
          model_id: config.model_id,
          model_name: config.model_name,
          endpoint_url: config.endpoint_url,
          test_suite_id: test_suite_id,
          test_suite_name: suite.name,
          prompt_limit: limit,
          concurrency: concurrency || 1,
        },
      })
      .select()
      .single();

    if (runError || !testRun) {
      console.error('[API/demo/v2/batch-test] Failed to create test run:', runError);
      return NextResponse.json(
        { error: 'Failed to create batch test run' },
        { status: 500 }
      );
    }

    // Start background processing (non-blocking)
    processBackgroundBatchTest(
      testRun.id,
      session_id,
      config,
      prompts,
      concurrency || 1
    ).catch(err => {
      console.error('[API/demo/v2/batch-test] Background processing error:', err);
    });

    return NextResponse.json({
      success: true,
      test_run_id: testRun.id,
      status: 'running',
      total_prompts: prompts.length,
    });
  } catch (error) {
    console.error('[API/demo/v2/batch-test] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Background batch test processor
 */
const BATCH_TEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Background batch test processor
 */
async function processBackgroundBatchTest(
  testRunId: string,
  sessionId: string,
  config: {
    endpoint_url: string;
    api_key_encrypted: string;
    model_id: string;
    model_name?: string;
  },
  prompts: Array<{ prompt: string; expected_answer?: string; category?: string }>,
  concurrency: number
) {
  console.log(`[Background Batch] Starting test run ${testRunId} with ${prompts.length} prompts and concurrency ${concurrency}`);

  // Create fresh supabase client for background processing
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Batch test timed out')), BATCH_TEST_TIMEOUT_MS)
  );

  const batchPromise = async () => {
    // Decrypt API key
    let apiKey: string;
    try {
      apiKey = decryptApiKey(config.api_key_encrypted);
    } catch (error) {
      console.error('[Background Batch] Failed to decrypt API key:', error);
      await supabase
        .from('demo_batch_test_runs')
        .update({
          status: 'failed',
          error: 'Failed to decrypt API key',
          completed_at: new Date().toISOString(),
        })
        .eq('id', testRunId);
      return;
    }

    const endpoint: DemoModelEndpoint = {
      url: config.endpoint_url,
      apiKey,
      modelId: config.model_id,
    };

    let completed = 0;
    let failed = 0;
    
    const limit = pLimit(concurrency);

    const promises = prompts.map((promptObj, i) =>
      limit(async () => {
        // Check for cancellation
        const { data: runData, error: runError } = await supabase
          .from('demo_batch_test_runs')
          .select('is_cancelled')
          .eq('id', testRunId)
          .single();

        if (runError) {
          console.error('[Background Batch] Failed to check cancellation status:', runError);
        }

        if (runData?.is_cancelled) {
          console.log(`[Background Batch] Test run ${testRunId} cancelled`);
          return;
        }

        console.log(`[Background Batch] Processing prompt ${i + 1}/${prompts.length}`);

        try {
          const result = await callDemoModelSimple(endpoint, promptObj.prompt, {
            maxTokens: 1024,
            timeout: 60000,
          });

          // Store result
          await supabase.from('demo_batch_test_results').insert({
            test_run_id: testRunId,
            demo_session_id: sessionId,
            prompt: promptObj.prompt,
            response: result.response || null,
            latency_ms: result.latency_ms,
            success: result.success,
            error: result.error || null,
            model_id: config.model_id,
            input_tokens: result.input_tokens,
            output_tokens: result.output_tokens,
          });

          if (result.success) {
            completed++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`[Background Batch] Error on prompt ${i + 1}:`, error);
          failed++;

          // Store error result
          await supabase.from('demo_batch_test_results').insert({
            test_run_id: testRunId,
            demo_session_id: sessionId,
            prompt: promptObj.prompt,
            response: null,
            latency_ms: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            model_id: config.model_id,
          });
        } finally {
          // Update progress
          await supabase
            .from('demo_batch_test_runs')
            .update({
              completed_prompts: completed,
              failed_prompts: failed,
            })
            .eq('id', testRunId);
        }
      })
    );

    await Promise.all(promises);

    // Mark as completed
    const { data: runData } = await supabase
      .from('demo_batch_test_runs')
      .select('is_cancelled')
      .eq('id', testRunId)
      .single();

    if (runData?.is_cancelled) {
      await supabase
        .from('demo_batch_test_runs')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', testRunId);
      return;
    }

    const finalStatus = failed === prompts.length ? 'failed' : 'completed';

    await supabase
      .from('demo_batch_test_runs')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
      })
      .eq('id', testRunId);

    console.log(`[Background Batch] Test run ${testRunId} completed: ${completed} succeeded, ${failed} failed`);
  };

  try {
    await Promise.race([batchPromise(), timeoutPromise]);
  } catch (error) {
    console.error(`[Background Batch] Test run ${testRunId} failed:`, error);
    await supabase
      .from('demo_batch_test_runs')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        completed_at: new Date().toISOString(),
      })
      .eq('id', testRunId);
  }
}

function pLimit(concurrency: number) {
  const queue: (() => void)[] = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      queue.shift()!();
    }
  };

  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const task = () => {
        activeCount++;
        fn().then(
          (res: T) => {
            resolve(res);
            next();
          },
          (err: any) => {
            reject(err);
            next();
          }
        );
      };

      if (activeCount < concurrency) {
        task();
      } else {
        queue.push(task);
      }
    });
  };

  return run;
}

/**
 * DELETE /api/demo/v2/batch-test
 * Cancel a running batch test
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const test_run_id = searchParams.get('test_run_id');

    if (!test_run_id) {
      return NextResponse.json(
        { error: 'Missing test_run_id parameter' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('demo_batch_test_runs')
      .update({ status: 'cancelled', is_cancelled: true })
      .eq('id', test_run_id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Failed to cancel test run or test run not found' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Test run cancelled' });
  } catch (error) {
    console.error('[API/demo/v2/batch-test] Cancel error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/demo/v2/batch-test
 * Get batch test status and results
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const session_id = searchParams.get('session_id');
    const test_run_id = searchParams.get('test_run_id');

    if (!session_id && !test_run_id) {
      return NextResponse.json(
        { error: 'Missing session_id or test_run_id parameter' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get test run(s)
    let query = supabase
      .from('demo_batch_test_runs')
      .select('*')
      .order('created_at', { ascending: false });

    if (test_run_id) {
      query = query.eq('id', test_run_id);
    } else if (session_id) {
      query = query.eq('demo_session_id', session_id);
    }

    const { data: testRuns, error: runError } = await query;

    if (runError) {
      console.error('[API/demo/v2/batch-test] Query error:', runError);
      return NextResponse.json(
        { error: 'Failed to fetch test runs' },
        { status: 500 }
      );
    }

    if (!testRuns || testRuns.length === 0) {
      return NextResponse.json(
        { error: 'No test runs found' },
        { status: 404 }
      );
    }

    // For single test run, include results
    if (test_run_id) {
      const testRun = testRuns[0];

      // Get results
      const { data: results, error: resultsError } = await supabase
        .from('demo_batch_test_results')
        .select('*')
        .eq('test_run_id', test_run_id)
        .order('created_at', { ascending: true });

      if (resultsError) {
        console.error('[API/demo/v2/batch-test] Results query error:', resultsError);
      }

      return NextResponse.json({
        ...testRun,
        progress: testRun.total_prompts > 0
          ? (testRun.completed_prompts + testRun.failed_prompts) / testRun.total_prompts
          : 0,
        results: results || [],
      });
    }

    // For session query, return list of runs
    return NextResponse.json({
      test_runs: testRuns.map(run => ({
        ...run,
        progress: run.total_prompts > 0
          ? (run.completed_prompts + run.failed_prompts) / run.total_prompts
          : 0,
      })),
    });
  } catch (error) {
    console.error('[API/demo/v2/batch-test] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
