/**
 * Batch Testing SSE Streaming API
 * POST /api/batch-testing/stream - Start batch test with SSE streaming
 *
 * Streams progress events to keep connection alive on serverless platforms.
 * This solves the issue where background processing gets killed on Render/Vercel.
 *
 * Events: started, progress, result, completed, error
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractPrompts } from '@/lib/tools/prompt-extractor/prompt-extractor.service';
import { extractPromptsFromDataset } from '@/lib/batch-testing/dataset-prompt-extractor';
import type { BatchTestConfig, SessionTag, JudgeConfig } from '@/lib/batch-testing/types';
import { categorizeError } from '@/lib/batch-testing/error-categorizer';
import { STATUS } from '@/lib/constants';
import { validateRequestWithScope, extractApiKeyFromHeaders } from '@/lib/auth/api-key-validator';
import { sendBatchTestAlert } from '@/lib/alerts';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for serverless

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const API_KEY_PREFIX = 'wak_';

interface SSEEvent {
  type: 'started' | 'progress' | 'result' | 'completed' | 'error';
  test_run_id?: string;
  total_prompts?: number;
  current_prompt?: number;
  completed_prompts?: number;
  failed_prompts?: number;
  result?: {
    prompt_index: number;
    success: boolean;
    error?: string;
  };
  status?: string;
  error?: string;
}

type BatchTestingAuth =
  | { mode: 'session'; userId: string; authorizationHeader: string }
  | { mode: 'apiKey'; userId: string; apiKey: string; keyId?: string };

function sendSSE(controller: ReadableStreamDefaultController, encoder: TextEncoder, event: SSEEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  controller.enqueue(encoder.encode(data));
}

async function authenticateBatchTesting(req: NextRequest): Promise<
  | { ok: true; auth: BatchTestingAuth }
  | { ok: false; status: number; error: string }
> {
  const headerApiKey = req.headers.get('x-api-key') || req.headers.get('x-workspace-api-key');
  const authHeader = req.headers.get('authorization');

  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  const bearerValue = bearerMatch?.[1]?.trim() || null;
  const apiKeyInAuthorization = !!(bearerValue && bearerValue.startsWith(API_KEY_PREFIX));

  if (headerApiKey || apiKeyInAuthorization) {
    const validation = await validateRequestWithScope(req.headers, 'testing');
    if (!validation.isValid || !validation.userId) {
      return {
        ok: false,
        status: validation.scopeError ? 403 : (validation.rateLimitExceeded ? 429 : 401),
        error: validation.errorMessage || 'Unauthorized',
      };
    }

    const extractedApiKey = extractApiKeyFromHeaders(req.headers);
    if (!extractedApiKey || !extractedApiKey.startsWith(API_KEY_PREFIX)) {
      return { ok: false, status: 401, error: 'Invalid API key' };
    }

    return { ok: true, auth: { mode: 'apiKey', userId: validation.userId, apiKey: extractedApiKey, keyId: validation.keyId } };
  }

  if (!authHeader) {
    return { ok: false, status: 401, error: 'Unauthorized - no auth header' };
  }

  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseAnon) {
    return { ok: false, status: 500, error: 'Server configuration error' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized - invalid token' };
  }

  return { ok: true, auth: { mode: 'session', userId: user.id, authorizationHeader: authHeader } };
}

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

async function safeSendBatchTestAlert(
  type: 'batch_test_completed' | 'batch_test_failed',
  data: {
    testRunId: string;
    userId: string;
    modelName: string | null;
    testRunName: string | null;
    status: string;
    totalPrompts: number;
    completedPrompts: number;
    failedPrompts: number;
    errorMessage: string | null;
  }
): Promise<void> {
  try {
    await sendBatchTestAlert(type, data);
  } catch (err) {
    console.error('[Batch Testing Alerts] Failed to send alert:', err);
  }
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  // Authenticate first
  const authResult = await authenticateBatchTesting(req);
  if (!authResult.ok) {
    const { error, status } = authResult;
    return new Response(
      JSON.stringify({ error }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const auth = authResult.auth;

  // Parse request body
  let config: Record<string, unknown>;
  try {
    const body = await req.json();
    config = body.config;

    if (!config || typeof config !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid config object' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!config.test_suite_id && !config.dataset_id && !config.source_path) {
      return new Response(
        JSON.stringify({ error: 'Missing config.test_suite_id, config.dataset_id, or config.source_path' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!config.model_id) {
      return new Response(
        JSON.stringify({ error: 'Missing config.model_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (auth.mode === 'apiKey' && (config.judge_config as { enabled?: boolean })?.enabled) {
      return new Response(
        JSON.stringify({ error: 'judge_config requires session auth' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const supabaseReadClient = auth.mode === 'session'
    ? createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: auth.authorizationHeader } },
      })
    : supabaseAdmin;

  // Build batch config
  const batchConfig: BatchTestConfig = {
    model_name: config.model_id as string,
    prompt_limit: (config.prompt_limit as number) || parseInt(process.env.BATCH_TESTING_DEFAULT_PROMPT_LIMIT || '25', 10),
    concurrency: (config.concurrency as number) || parseInt(process.env.BATCH_TESTING_DEFAULT_CONCURRENCY || '3', 10),
    delay_ms: (config.delay_ms as number) || parseInt(process.env.BATCH_TESTING_DEFAULT_DELAY_MS || '1000', 10),
    source_path: (config.source_path as string) || '',
    benchmark_id: config.benchmark_id as string | undefined,
    session_tag: config.session_tag as SessionTag | undefined,
    judge_config: config.judge_config as JudgeConfig | undefined
  };

  // Extract prompts before starting stream
  let extractionResult: { prompts: string[]; total: number; errors?: string[] };
  let datasetName: string | null = null;

  try {
    if (config.test_suite_id) {
      const { data: testSuite, error: suiteError } = await supabaseReadClient
        .from('test_suites')
        .select('name, prompts, prompt_count')
        .eq('id', config.test_suite_id)
        .eq('user_id', auth.userId)
        .single();

      if (suiteError || !testSuite) {
        return new Response(
          JSON.stringify({ error: 'Test suite not found or access denied' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const suitePrompts = Array.isArray(testSuite.prompts) ? testSuite.prompts : [];
      const limitedPrompts = suitePrompts.slice(0, batchConfig.prompt_limit);

      extractionResult = { prompts: limitedPrompts, total: limitedPrompts.length, errors: [] };
      datasetName = `Test Suite: ${testSuite.name}`;

    } else if (config.dataset_id) {
      const datasetResult = await extractPromptsFromDataset(
        config.dataset_id as string,
        batchConfig.prompt_limit,
        auth.userId,
        auth.mode === 'session'
          ? { mode: 'session', sessionToken: auth.authorizationHeader }
          : { mode: 'service' }
      );

      extractionResult = {
        prompts: datasetResult.prompts,
        total: datasetResult.total,
        errors: datasetResult.errors
      };
      datasetName = datasetResult.datasetName;

    } else {
      extractionResult = await extractPrompts({
        directory: batchConfig.source_path,
        filePattern: '.json',
        maxPrompts: batchConfig.prompt_limit
      });
    }

    if (extractionResult.prompts.length === 0) {
      return new Response(
        JSON.stringify({ error: extractionResult.errors?.join(', ') || 'No prompts extracted' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to extract prompts' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const customName = (config.test_run_name as string)?.trim() ||
    generateDefaultTestRunName(batchConfig.model_name, datasetName);

  // Create the SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      let testRunId: string | undefined = undefined;
      let runId: string | null = null;
      let conversationId: string | null = null;
      let completed = 0;
      let failed = 0;

      try {
        // Create batch test run record
        const { data: batchTestRun, error: createError } = await supabaseAdmin
          .from('batch_test_runs')
          .insert({
            user_id: auth.userId,
            model_name: batchConfig.model_name,
            status: STATUS.RUNNING,
            total_prompts: extractionResult.total,
            completed_prompts: 0,
            failed_prompts: 0,
            config: {
              ...batchConfig,
              test_suite_name: datasetName,
              custom_name: customName
            }
          })
          .select()
          .single();

        if (createError || !batchTestRun) {
          sendSSE(controller, encoder, {
            type: 'error',
            error: 'Failed to create batch test run: ' + (createError?.message || 'Unknown error')
          });
          controller.close();
          return;
        }

        testRunId = batchTestRun.id;

        // Create experiment run
        const { data: experimentRun } = await supabaseAdmin
          .from('runs')
          .insert({
            name: `Batch Test - ${batchConfig.model_name} - ${new Date().toISOString()}`,
            model_name: batchConfig.model_name,
            model_version: 'default',
            prompt_version: 'v1',
            dataset_version: batchConfig.source_path,
            config_json: batchConfig,
            started_at: new Date().toISOString(),
            created_by: auth.userId
          })
          .select()
          .single();

        runId = experimentRun?.id || null;

        // Create conversation
        const widgetSessionId = `batch_test_${testRunId}`;
        const { data: conversation, error: convError } = await supabaseAdmin
          .from('conversations')
          .insert({
            user_id: auth.userId,
            title: customName,
            widget_session_id: widgetSessionId,
            is_widget_session: true,
            llm_model_id: batchConfig.model_name,
            run_id: runId,
            batch_test_run_id: testRunId,
            session_id: batchConfig.session_tag?.session_id || null,
            experiment_name: batchConfig.session_tag?.experiment_name || null
          })
          .select()
          .single();

        if (convError) {
          sendSSE(controller, encoder, {
            type: 'error',
            error: 'Failed to create conversation: ' + convError.message
          });

          await supabaseAdmin
            .from('batch_test_runs')
            .update({ status: STATUS.FAILED, error: convError.message, completed_at: new Date().toISOString() })
            .eq('id', testRunId);

          controller.close();
          return;
        }

        conversationId = conversation.id;

        // Send started event
        sendSSE(controller, encoder, {
          type: 'started',
          test_run_id: testRunId,
          total_prompts: extractionResult.total
        });

        // Process each prompt
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

        for (let i = 0; i < extractionResult.prompts.length; i++) {
          const prompt = extractionResult.prompts[i];

          // Send progress event
          sendSSE(controller, encoder, {
            type: 'progress',
            test_run_id: testRunId,
            current_prompt: i + 1,
            total_prompts: extractionResult.total,
            completed_prompts: completed,
            failed_prompts: failed
          });

          let success = false;
          try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (auth.mode === 'apiKey') {
              headers['X-API-Key'] = auth.apiKey;
            } else {
              headers['Authorization'] = auth.authorizationHeader;
            }

            const chatResponse = await fetch(`${baseUrl}/api/chat`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                modelId: batchConfig.model_name,
                widgetSessionId: widgetSessionId,
                forceNonStreaming: true,
                runId: runId,
                benchmarkId: batchConfig.benchmark_id
              })
            });

            if (chatResponse.ok) {
              await chatResponse.text(); // Consume response
              success = true;
              completed++;

              // Step 2: If judge is enabled, fetch the message ID and evaluate
              if (batchConfig.judge_config?.enabled && batchConfig.judge_config.criteria.length > 0 && auth.mode === 'session' && conversationId) {
                // Fetch the most recent assistant message from this conversation
                const { data: recentMessage } = await supabaseAdmin
                  .from('messages')
                  .select('id')
                  .eq('conversation_id', conversationId)
                  .eq('role', 'assistant')
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .single();

                const messageId = recentMessage?.id;

                if (messageId) {
                  console.log(`[BatchTest/Stream] Prompt ${i + 1}: Starting LLM judge evaluation with ${batchConfig.judge_config.criteria.length} criteria`);

                  try {
                    const judgeResponse = await fetch(`${baseUrl}/api/evaluation/judge`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': auth.authorizationHeader
                      },
                      body: JSON.stringify({
                        message_id: messageId,
                        criteria: batchConfig.judge_config.criteria,
                        judge_model: batchConfig.judge_config.model,
                        save_to_db: true
                      })
                    });

                    if (judgeResponse.ok) {
                      const judgeData = await judgeResponse.json();
                      const avgScore = judgeData.evaluations?.reduce((sum: number, e: { score?: number }) => sum + (e.score || 0), 0) / (judgeData.evaluations?.length || 1);
                      console.log(`[BatchTest/Stream] Prompt ${i + 1}: Judge evaluation complete, avg score: ${avgScore.toFixed(1)}/10`);
                    } else {
                      const judgeError = await judgeResponse.text();
                      console.error(`[BatchTest/Stream] Prompt ${i + 1}: Judge evaluation failed:`, judgeError.substring(0, 200));
                    }
                  } catch (judgeError) {
                    console.error(`[BatchTest/Stream] Prompt ${i + 1}: Judge error:`, judgeError);
                    // Don't fail the prompt if judge fails
                  }
                } else {
                  console.warn(`[BatchTest/Stream] Prompt ${i + 1}: Could not find message ID for judge evaluation`);
                }
              }
            } else {
              failed++;
            }
          } catch (err) {
            failed++;
            const { category, severity } = categorizeError(err);
            try {
              await supabaseAdmin.from('errors').insert({
                error_type: category,
                error_message: err instanceof Error ? err.message : String(err),
                stack_trace: err instanceof Error ? err.stack : null,
                severity: severity,
                metadata_json: { test_run_id: testRunId, prompt_index: i, model_id: batchConfig.model_name }
              });
            } catch {
              // Silently ignore error logging failures
            }
          }

          // Send result event
          sendSSE(controller, encoder, {
            type: 'result',
            test_run_id: testRunId,
            current_prompt: i + 1,
            completed_prompts: completed,
            failed_prompts: failed,
            result: { prompt_index: i, success }
          });

          // Update progress in database
          await supabaseAdmin
            .from('batch_test_runs')
            .update({ completed_prompts: completed, failed_prompts: failed })
            .eq('id', testRunId);

          // Delay between prompts
          if (i < extractionResult.prompts.length - 1 && batchConfig.delay_ms > 0) {
            await new Promise(resolve => setTimeout(resolve, batchConfig.delay_ms));
          }
        }

        // Mark as completed
        const finalStatus = failed === extractionResult.total ? STATUS.FAILED : STATUS.COMPLETED;

        await supabaseAdmin
          .from('batch_test_runs')
          .update({
            status: finalStatus,
            completed_at: new Date().toISOString(),
            completed_prompts: completed,
            failed_prompts: failed
          })
          .eq('id', testRunId);

        if (runId) {
          await supabaseAdmin.from('runs').update({ completed_at: new Date().toISOString() }).eq('id', runId);
        }

        // Send completed event
        sendSSE(controller, encoder, {
          type: 'completed',
          test_run_id: testRunId,
          status: finalStatus,
          completed_prompts: completed,
          failed_prompts: failed
        });

        await safeSendBatchTestAlert(failed > 0 ? 'batch_test_failed' : 'batch_test_completed', {
          testRunId,
          userId: auth.userId,
          modelName: batchConfig.model_name,
          testRunName: customName,
          status: finalStatus,
          totalPrompts: extractionResult.total,
          completedPrompts: completed,
          failedPrompts: failed,
          errorMessage: failed > 0 ? `${failed} prompts failed` : null,
        });

        console.log(`[BatchTest/Stream] Completed: ${completed} succeeded, ${failed} failed`);

      } catch (error) {
        console.error('[BatchTest/Stream] Error:', error);

        sendSSE(controller, encoder, {
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        if (testRunId) {
          await supabaseAdmin
            .from('batch_test_runs')
            .update({
              status: STATUS.FAILED,
              error: error instanceof Error ? error.message : 'Unknown error',
              completed_at: new Date().toISOString()
            })
            .eq('id', testRunId);

          await safeSendBatchTestAlert('batch_test_failed', {
            testRunId,
            userId: auth.userId,
            modelName: batchConfig.model_name,
            testRunName: customName,
            status: STATUS.FAILED,
            totalPrompts: extractionResult.total,
            completedPrompts: completed,
            failedPrompts: failed,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
