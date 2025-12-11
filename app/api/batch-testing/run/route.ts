/**
 * @swagger
 * /api/batch-testing/run:
 *   post:
 *     summary: Run batch tests on model
 *     description: |
 *       Execute batch testing to measure real-time model performance metrics.
 *
 *       This endpoint runs prompts through the /api/chat endpoint, automatically
 *       collecting and persisting analytics data including:
 *       - Response quality metrics
 *       - Latency measurements
 *       - Token usage
 *       - Error rates
 *
 *       **Use Cases:**
 *       - Continuous model monitoring
 *       - A/B testing different models
 *       - Regression testing after model updates
 *       - Performance benchmarking
 *     tags:
 *       - Batch Testing
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - config
 *             properties:
 *               config:
 *                 type: object
 *                 required:
 *                   - model_id
 *                 properties:
 *                   model_id:
 *                     type: string
 *                     description: Model ID from your registered models
 *                     example: "gpt-4-turbo"
 *                   test_suite_id:
 *                     type: string
 *                     description: ID of test suite with prompts (recommended)
 *                     example: "550e8400-e29b-41d4-a716-446655440000"
 *                   dataset_id:
 *                     type: string
 *                     description: ID of saved dataset (alternative to test_suite_id)
 *                     example: "dataset_abc123"
 *                   source_path:
 *                     type: string
 *                     description: File path to prompts (alternative to test_suite_id)
 *                     example: "/path/to/prompts.json"
 *                   prompt_limit:
 *                     type: integer
 *                     default: 25
 *                     description: Maximum number of prompts to test
 *                     example: 100
 *                   concurrency:
 *                     type: integer
 *                     default: 3
 *                     description: Number of concurrent requests
 *                     example: 5
 *                   delay_ms:
 *                     type: integer
 *                     default: 1000
 *                     description: Delay between requests in milliseconds
 *                     example: 500
 *     responses:
 *       200:
 *         description: Batch test completed successfully
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
 *                   description: Unique test run identifier
 *                   example: "test_xyz789"
 *                 results:
 *                   type: object
 *                   properties:
 *                     total_prompts:
 *                       type: integer
 *                       example: 100
 *                     successful:
 *                       type: integer
 *                       example: 98
 *                     failed:
 *                       type: integer
 *                       example: 2
 *                     avg_latency_ms:
 *                       type: number
 *                       example: 1234.56
 *                     total_tokens:
 *                       type: integer
 *                       example: 15000
 *                 analytics_url:
 *                   type: string
 *                   description: URL to view detailed analytics
 *                   example: "https://app.example.com/analytics/test_xyz789"
 *       400:
 *         description: Bad request - Missing or invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractPrompts } from '@/lib/tools/prompt-extractor/prompt-extractor.service';
import { extractPromptsFromDataset } from '@/lib/batch-testing/dataset-prompt-extractor';
import type { BatchTestConfig } from '@/lib/batch-testing/types';
import { categorizeError } from '@/lib/batch-testing/error-categorizer';
import { STATUS } from '@/lib/constants';

// Use Node.js runtime for file system operations
export const runtime = 'nodejs';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Generate a descriptive default name for a batch test run
 * Format: "{model_name} - {test_suite_name} - {date}"
 */
function generateDefaultTestRunName(modelName: string, testSuiteName: string | null): string {
  const date = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  if (testSuiteName) {
    return `${modelName} - ${testSuiteName} - ${date}`;
  }

  return `${modelName} - ${date}`;
}

export async function POST(req: NextRequest) {
  try {
    console.log('[Batch Testing Run] Request received');

    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    // Create authenticated Supabase client
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const { config } = body;

    if (!config || typeof config !== 'object') {
      return NextResponse.json(
        { error: 'Missing or invalid config object' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!config.test_suite_id && !config.dataset_id && !config.source_path) {
      return NextResponse.json(
        { error: 'Missing config.test_suite_id, config.dataset_id, or config.source_path (one is required)' },
        { status: 400 }
      );
    }

    if (!config.model_id) {
      return NextResponse.json(
        { error: 'Missing config.model_id (must be a registered model from models page)' },
        { status: 400 }
      );
    }

    // Note: API key no longer required - using session token from authHeader

    const batchConfig: BatchTestConfig = {
      model_name: config.model_id, // Using model_id from registry
      prompt_limit: config.prompt_limit || parseInt(process.env.BATCH_TESTING_DEFAULT_PROMPT_LIMIT || '25', 10),
      concurrency: config.concurrency || parseInt(process.env.BATCH_TESTING_DEFAULT_CONCURRENCY || '3', 10),
      delay_ms: config.delay_ms || parseInt(process.env.BATCH_TESTING_DEFAULT_DELAY_MS || '1000', 10),
      source_path: config.source_path,
      benchmark_id: config.benchmark_id,  // Pass benchmark_id for validator execution
      session_tag: config.session_tag,  // Session tagging for analytics
      judge_config: config.judge_config  // LLM judge configuration
    };

    console.log('[Batch Testing Run] ⚠️ BENCHMARK ID CHECK:', {
      configBenchmarkId: config.benchmark_id,
      batchConfigBenchmarkId: batchConfig.benchmark_id,
      type: typeof batchConfig.benchmark_id,
      truthy: !!batchConfig.benchmark_id
    });

    console.log('[Batch Testing Run] Starting batch test:', {
      userId: user.id,
      model: batchConfig.model_name,
      promptLimit: batchConfig.prompt_limit,
      testSuiteId: config.test_suite_id || 'none',
      benchmarkId: batchConfig.benchmark_id || 'NONE',
      datasetId: config.dataset_id || 'none',
      sourcePath: config.source_path || 'none'
    });

    // Step 1: Extract prompts
    let extractionResult: { prompts: string[]; total: number; errors?: string[] };
    let datasetName: string | null = null;

    if (config.test_suite_id) {
      // NEW: Use test suite extraction (separate from training data)
      console.log('[Batch Testing Run] Using test suite extraction for:', config.test_suite_id);

      const { data: testSuite, error: suiteError } = await supabase
        .from('test_suites')
        .select('name, prompts, prompt_count')
        .eq('id', config.test_suite_id)
        .eq('user_id', user.id)
        .single();

      if (suiteError || !testSuite) {
        console.error('[Batch Testing Run] Test suite fetch error:', suiteError);
        return NextResponse.json(
          { error: 'Test suite not found or access denied' },
          { status: 404 }
        );
      }

      // Extract prompts from JSONB array
      const suitePrompts = Array.isArray(testSuite.prompts) ? testSuite.prompts : [];
      const limitedPrompts = suitePrompts.slice(0, batchConfig.prompt_limit);

      extractionResult = {
        prompts: limitedPrompts,
        total: limitedPrompts.length,
        errors: []
      };

      datasetName = `Test Suite: ${testSuite.name}`;

      console.log('[Batch Testing Run] Test suite extraction complete:', {
        testSuiteName: testSuite.name,
        totalPrompts: testSuite.prompt_count,
        promptsExtracted: limitedPrompts.length
      });

    } else if (config.dataset_id) {
      // Use dataset-based extraction (training data)
      console.log('[Batch Testing Run] Using dataset extraction for:', config.dataset_id);

      const datasetResult = await extractPromptsFromDataset(
        config.dataset_id,
        batchConfig.prompt_limit,
        user.id,
        authHeader
      );

      extractionResult = {
        prompts: datasetResult.prompts,
        total: datasetResult.total,
        errors: datasetResult.errors
      };

      datasetName = datasetResult.datasetName;

      console.log('[Batch Testing Run] Dataset extraction complete:', {
        datasetName: datasetResult.datasetName,
        format: datasetResult.format,
        promptsExtracted: datasetResult.total
      });
    } else {
      // LEGACY: Use old conversation-based extraction
      console.log('[Batch Testing Run] Using legacy conversation extraction');

      extractionResult = await extractPrompts({
        directory: batchConfig.source_path,
        filePattern: '.json',
        maxPrompts: batchConfig.prompt_limit
      });
    }

    if (extractionResult.prompts.length === 0) {
      const errorMsg = extractionResult.errors?.join(', ') || 'No prompts extracted from source';
      return NextResponse.json(
        { error: errorMsg },
        { status: 400 }
      );
    }

    console.log('[Batch Testing Run] Extracted prompts:', extractionResult.total);

    // Step 2: Create batch test run record (use service key for DB operations)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Generate or use custom name for the test run
    const customName = config.test_run_name?.trim() ||
      generateDefaultTestRunName(batchConfig.model_name, datasetName);

    const { data: batchTestRuns, error: createError } = await supabaseAdmin
      .from('batch_test_runs')
      .insert({
        user_id: user.id,
        model_name: batchConfig.model_name,
        status: STATUS.RUNNING,
        total_prompts: extractionResult.total,
        completed_prompts: 0,
        failed_prompts: 0,
        config: {
          ...batchConfig,
          test_suite_name: datasetName, // Store test suite name in config JSON
          custom_name: customName // Store custom or generated name
        }
      })
      .select();

    if (createError || !batchTestRuns || batchTestRuns.length === 0) {
      console.error('[Batch Testing Run] Failed to create batch test run:', createError);
      return NextResponse.json(
        { error: 'Failed to create batch test run: ' + (createError?.message || 'No data returned') },
        { status: 500 }
      );
    }

    const batchTestRun = batchTestRuns[0];

    console.log('[Batch Testing Run] Created batch test run:', batchTestRun.id);

    // Step 2.5: Create experiment run for tracking
    console.log('[Batch Testing Run] Attempting to create experiment run...');
    const { data: experimentRun, error: runError } = await supabaseAdmin
      .from('runs')
      .insert({
        name: `Batch Test - ${batchConfig.model_name} - ${new Date().toISOString()}`,
        model_name: batchConfig.model_name,
        model_version: 'default',
        prompt_version: 'v1',
        dataset_version: batchConfig.source_path,
        config_json: batchConfig,
        started_at: new Date().toISOString(),
        created_by: user.id
      })
      .select()
      .single();

    if (runError) {
      console.error('[Batch Testing Run] ERROR creating experiment run:', {
        error: runError,
        message: runError.message,
        details: runError.details,
        hint: runError.hint
      });
    }

    if (!experimentRun) {
      console.error('[Batch Testing Run] Experiment run data is null/undefined');
    }

    const runId = experimentRun?.id || null;
    console.log('[Batch Testing Run] Created experiment run:', runId);
    console.log('[Batch Testing Run] Full run data:', experimentRun);

    // Step 3: Start background processing (don't await - return immediately)
    processBackgroundBatch(
      batchTestRun.id,
      user.id,
      extractionResult.prompts,
      batchConfig,
      runId,
      authHeader,  // Pass auth header for session token authentication
      customName   // Pass custom name for conversation title
    ).catch(error => {
      console.error('[Batch Testing Run] Background processing error:', error);
    });

    // Step 4: Return immediately with test run ID
    return NextResponse.json({
      success: true,
      test_run_id: batchTestRun.id,
      status: STATUS.RUNNING,
      total_prompts: extractionResult.total
    });

  } catch (error) {
    console.error('[Batch Testing Run] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * Background batch processing function
 * Sends prompts through /api/chat endpoint for automatic metadata collection
 */
async function processBackgroundBatch(
  testRunId: string,
  userId: string,
  prompts: string[],
  config: BatchTestConfig,
  runId: string | null,
  authHeader: string,  // Session token for authentication
  customName: string   // Custom name for the batch test (used in conversation title)
): Promise<void> {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const widgetSessionId = `batch_test_${testRunId}`;

  console.log('[Background Batch] Starting processing:', {
    testRunId,
    promptCount: prompts.length,
    modelId: config.model_name,
    widgetSessionId
  });

  // Pre-create the conversation to avoid race conditions
  const { data: conversation, error: convError } = await supabaseAdmin
    .from('conversations')
    .insert({
      user_id: userId,
      title: customName,  // Use the custom name from batch test configuration
      widget_session_id: widgetSessionId,
      is_widget_session: true,
      llm_model_id: config.model_name,
      run_id: runId,
      batch_test_run_id: testRunId,
      // Add session tagging if provided
      session_id: config.session_tag?.session_id || null,
      experiment_name: config.session_tag?.experiment_name || null
    })
    .select()
    .single();

  if (convError) {
    console.error('[Background Batch] Failed to create conversation:', convError);
    await supabaseAdmin
      .from('batch_test_runs')
      .update({
        status: STATUS.FAILED,
        error: 'Failed to create conversation: ' + convError.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', testRunId);
    return;
  }

  console.log('[Background Batch] Created conversation:', conversation.id);

  let completed = 0;
  let failed = 0;

  try {
    // Process prompts sequentially to maintain order in single conversation
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      console.log(`[Background Batch] Processing prompt ${i + 1}/${prompts.length}`);

      const success = await processSinglePrompt(
        testRunId,
        config.model_name,
        prompt,
        authHeader,
        i,
        runId,
        config.benchmark_id,
        widgetSessionId,
        conversation.id,  // Pass conversation ID for efficient lookups
        config.judge_config  // Pass judge configuration
      );

      if (success) {
        completed++;
      } else {
        failed++;
      }

      // Update progress in database
      await supabaseAdmin
        .from('batch_test_runs')
        .update({
          completed_prompts: completed,
          failed_prompts: failed
        })
        .eq('id', testRunId);

      console.log(`[Background Batch] Progress: ${completed + failed}/${prompts.length}`);

      // Rate limiting delay between prompts
      if (i < prompts.length - 1 && config.delay_ms > 0) {
        await new Promise(resolve => setTimeout(resolve, config.delay_ms));
      }
    }

    // Mark batch test run as completed
    await supabaseAdmin
      .from('batch_test_runs')
      .update({
        status: STATUS.COMPLETED,
        completed_at: new Date().toISOString(),
        completed_prompts: completed,
        failed_prompts: failed
      })
      .eq('id', testRunId);

    console.log('[Background Batch] Batch test run completed:', {
      testRunId,
      completed,
      failed
    });

    // Complete experiment run
    if (runId) {
      await supabaseAdmin
        .from('runs')
        .update({
          completed_at: new Date().toISOString()
        })
        .eq('id', runId);

      console.log('[Background Batch] Experiment run completed:', runId);
    }

  } catch (error) {
    console.error('[Background Batch] Fatal error:', error);

    // Mark batch test run as failed
    await supabaseAdmin
      .from('batch_test_runs')
      .update({
        status: STATUS.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })
      .eq('id', testRunId);
  }
}

/**
 * Process a single prompt by calling /api/chat endpoint
 * Returns true on success, false on failure
 */
async function processSinglePrompt(
  testRunId: string,
  modelId: string,
  prompt: string,
  authHeader: string,  // Session token for authentication
  promptIndex: number,
  runId: string | null,
  benchmarkId: string | undefined,
  widgetSessionId: string,
  conversationId: string,  // Conversation ID for efficient message lookup
  judgeConfig?: { enabled: boolean; model: string; criteria: string[] }
): Promise<boolean> {
  console.log(`[Process Prompt] ${promptIndex + 1}: Sending to /api/chat`);

  try {
    // Step 1: Call /api/chat endpoint (server-side)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const chatResponse = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader  // Use session token instead of API key
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        modelId: modelId,
        widgetSessionId: widgetSessionId,
        forceNonStreaming: true,  // Force metrics capture path
        runId: runId,  // Link to experiment run
        benchmarkId: benchmarkId  // Link to benchmark for task-specific evaluation
      })
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error(`[Process Prompt] ${promptIndex + 1}: Chat API error ${chatResponse.status}`, errorText.substring(0, 200));
      return false;
    }

    // Consume the response (it's a stream)
    await chatResponse.text();

    console.log(`[Process Prompt] ${promptIndex + 1}: Chat success`);

    // Step 2: If judge is enabled, fetch the message ID and evaluate
    if (judgeConfig?.enabled && judgeConfig.criteria.length > 0) {
      // Fetch the most recent assistant message from this conversation
      const { data: recentMessage } = await createClient(supabaseUrl, supabaseServiceKey)
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const messageId = recentMessage?.id;

      if (!messageId) {
        console.warn(`[Process Prompt] ${promptIndex + 1}: Could not find message ID for judge evaluation`);
        return true;  // Don't fail the prompt
      }
      console.log(`[Process Prompt] ${promptIndex + 1}: Starting LLM judge evaluation with ${judgeConfig.criteria.length} criteria`);

      try {
        const judgeResponse = await fetch(`${baseUrl}/api/evaluation/judge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            message_id: messageId,
            criteria: judgeConfig.criteria,
            judge_model: judgeConfig.model,
            save_to_db: true  // Save judgments to database
          })
        });

        if (judgeResponse.ok) {
          const judgeData = await judgeResponse.json();
          const avgScore = judgeData.evaluations?.reduce((sum: number, e: any) => sum + (e.score || 0), 0) / (judgeData.evaluations?.length || 1);
          console.log(`[Process Prompt] ${promptIndex + 1}: Judge evaluation complete, avg score: ${avgScore.toFixed(1)}/10 (${(avgScore / 10 * 100).toFixed(0)}%)`);
        } else {
          const judgeError = await judgeResponse.text();
          console.error(`[Process Prompt] ${promptIndex + 1}: Judge evaluation failed:`, judgeError.substring(0, 200));
          // Don't fail the whole prompt if judge fails, just log the error
        }
      } catch (judgeError) {
        console.error(`[Process Prompt] ${promptIndex + 1}: Judge error:`, judgeError);
        // Don't fail the whole prompt if judge fails
      }
    }

    return true;

  } catch (error) {
    console.error(`[Process Prompt] ${promptIndex}: Error:`, error);

    // Categorize and save error to database
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { category, severity } = categorizeError(error);

    try {
      await supabaseAdmin.from('errors').insert({
        error_type: category,
        error_message: error instanceof Error ? error.message : String(error),
        stack_trace: error instanceof Error ? error.stack : null,
        severity: severity,
        metadata_json: {
          test_run_id: testRunId,
          prompt_index: promptIndex,
          model_id: modelId
        }
      });
      console.log(`[Process Prompt] ${promptIndex}: Error logged:`, category, severity);
    } catch (dbError) {
      console.error(`[Process Prompt] ${promptIndex}: Failed to log error:`, dbError);
    }

    return false;
  }
}