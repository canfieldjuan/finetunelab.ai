/**
 * API Route - Batch Testing Run Test
 *
 * Runs a batch test by sending prompts through /api/chat endpoint.
 * This ensures all metadata collection happens automatically.
 * POST /api/batch-testing/run
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractPrompts } from '@/lib/tools/prompt-extractor/prompt-extractor.service';
import { extractPromptsFromDataset } from '@/lib/batch-testing/dataset-prompt-extractor';
import type { BatchTestConfig } from '@/lib/batch-testing/types';
import { categorizeError } from '@/lib/batch-testing/error-categorizer';

// Use Node.js runtime for file system operations
export const runtime = 'nodejs';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    if (!config.dataset_id && !config.source_path) {
      return NextResponse.json(
        { error: 'Missing config.dataset_id or config.source_path (one is required)' },
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
      prompt_limit: config.prompt_limit || 25,
      concurrency: config.concurrency || 3,
      delay_ms: config.delay_ms || 1000,
      source_path: config.source_path
    };

    console.log('[Batch Testing Run] Starting batch test:', {
      userId: user.id,
      model: batchConfig.model_name,
      promptLimit: batchConfig.prompt_limit,
      datasetId: config.dataset_id || 'none',
      sourcePath: config.source_path || 'none'
    });

    // Step 1: Extract prompts
    let extractionResult: { prompts: string[]; total: number; errors?: string[] };
    let datasetName: string | null = null;

    if (config.dataset_id) {
      // NEW: Use dataset-based extraction
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

    const { data: batchTestRun, error: createError } = await supabaseAdmin
      .from('batch_test_runs')
      .insert({
        user_id: user.id,
        model_name: batchConfig.model_name,
        dataset_name: datasetName,
        status: 'running',
        total_prompts: extractionResult.total,
        completed_prompts: 0,
        failed_prompts: 0,
        config: batchConfig
      })
      .select()
      .single();

    if (createError || !batchTestRun) {
      console.error('[Batch Testing Run] Failed to create batch test run:', createError);
      return NextResponse.json(
        { error: 'Failed to create batch test run: ' + createError?.message },
        { status: 500 }
      );
    }

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
      authHeader  // Pass auth header for session token authentication
    ).catch(error => {
      console.error('[Batch Testing Run] Background processing error:', error);
    });

    // Step 4: Return immediately with test run ID
    return NextResponse.json({
      success: true,
      test_run_id: batchTestRun.id,
      status: 'running',
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
  authHeader: string  // Session token for authentication
): Promise<void> {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[Background Batch] Starting processing:', {
    testRunId,
    promptCount: prompts.length,
    modelId: config.model_name
  });

  let completed = 0;
  let failed = 0;

  try {
    // Process prompts with rate limiting
    for (let i = 0; i < prompts.length; i += config.concurrency) {
      const batch = prompts.slice(i, i + config.concurrency);
      console.log(`[Background Batch] Processing batch ${Math.floor(i / config.concurrency) + 1}`);

      // Process batch in parallel
      const batchPromises = batch.map((prompt, batchIndex) =>
        processSinglePrompt(
          testRunId,
          config.model_name,
          prompt,
          authHeader,  // Pass session token auth header
          i + batchIndex,
          runId,
          config.benchmark_id  // Pass benchmark_id from config
        )
      );

      const results = await Promise.allSettled(batchPromises);

      // Count successes and failures
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          completed++;
        } else {
          failed++;
          console.error('[Background Batch] Prompt failed:',
            result.status === 'rejected' ? result.reason : 'unknown'
          );
        }
      });

      // Update progress in database
      await supabaseAdmin
        .from('batch_test_runs')
        .update({
          completed_prompts: completed,
          failed_prompts: failed
        })
        .eq('id', testRunId);

      console.log(`[Background Batch] Progress: ${completed}/${prompts.length}`);

      // Rate limiting delay between batches
      if (i + config.concurrency < prompts.length && config.delay_ms > 0) {
        console.log(`[Background Batch] Delaying ${config.delay_ms}ms before next batch`);
        await new Promise(resolve => setTimeout(resolve, config.delay_ms));
      }
    }

    // Mark batch test run as completed
    await supabaseAdmin
      .from('batch_test_runs')
      .update({
        status: 'completed',
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
        status: 'failed',
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
  benchmarkId?: string
): Promise<boolean> {
  // Use same session ID for all prompts in batch test (one conversation per batch)
  const widgetSessionId = `batch_test_${testRunId}`;

  console.log(`[Process Prompt] ${promptIndex}: Sending to /api/chat`);

  try {
    // Call /api/chat endpoint (server-side)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/chat`, {
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

    if (!response.ok) {
      console.error(`[Process Prompt] ${promptIndex}: API error ${response.status}`);
      return false;
    }

    console.log(`[Process Prompt] ${promptIndex}: Success`);

    // Update conversation to link to batch test run
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    await supabaseAdmin
      .from('conversations')
      .update({ batch_test_run_id: testRunId })
      .eq('widget_session_id', widgetSessionId);

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