/**
 * Training Execution Status API
 * GET /api/training/execute/{id}/status
 * Purpose: Check status of training execution and sync with provider
 * Supports: Colab, OpenAI, HuggingFace, Local
 * Date: 2025-10-24
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type { TrainingStatusResponse } from '@/lib/training/execution-types';
import { STATUS } from '@/lib/constants';
// DEPRECATED: import { recordUsageEvent } from '@/lib/usage/checker';

export const runtime = 'nodejs';

type TrainingExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

type TrainingExecutionRow = {
  id: string;
  provider: string;
  status: TrainingExecutionStatus;
  progress: number | null;
  logs?: string[];
  error?: string | null;
  result?: Record<string, unknown> | null;
  openai_job_id?: string | null;
  completed_at?: string | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const executionId = resolvedParams.id;

  console.log('[TrainingStatus] GET status for:', executionId);

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch execution record
    const { data: execution, error } = await supabase
      .from('training_executions')
      .select('*')
      .eq('id', executionId)
      .single<TrainingExecutionRow>();

    if (error || !execution) {
      console.error('[TrainingStatus] Execution not found:', executionId);
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    console.log('[TrainingStatus] Found execution:', {
      id: executionId,
      provider: execution.provider,
      status: execution.status,
      progress: execution.progress,
    });

    // Sync status with provider if needed
    if (execution.provider === 'openai' && execution.openai_job_id) {
      return await syncOpenAIStatus(supabase, execution);
    }

    // For other providers, return current status
    const response: TrainingStatusResponse = {
      execution_id: executionId,
      status: execution.status,
      progress: execution.progress ?? undefined,
      logs: execution.logs || [],
      error: execution.error || undefined,
      result: execution.result || undefined,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[TrainingStatus] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Sync OpenAI fine-tuning job status
async function syncOpenAIStatus(
  supabase: SupabaseClient,
  execution: TrainingExecutionRow
): Promise<NextResponse> {
  console.log('[TrainingStatus] Syncing OpenAI status for job:', execution.openai_job_id);

  try {
    // Verify OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('[TrainingStatus] OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'OpenAI integration not configured' },
        { status: 500 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Fetch job status from OpenAI
    const job = await openai.fineTuning.jobs.retrieve(execution.openai_job_id!);

    console.log('[TrainingStatus] OpenAI job status:', {
      id: job.id,
      status: job.status,
      trained_tokens: job.trained_tokens,
      fine_tuned_model: job.fine_tuned_model,
    });

    // Map OpenAI status to our status
    let status: TrainingExecutionStatus = execution.status;
    let progress = execution.progress || 0;
    let completedAt = execution.completed_at;
    let result: Record<string, unknown> = execution.result || {};
    let error = execution.error;

    if (job.status === STATUS.SUCCEEDED) {
      status = 'completed';
      progress = 100;
      completedAt = new Date().toISOString();
      result = {
        ...result,
        openai_fine_tuned_model: job.fine_tuned_model,
        openai_job_id: job.id,
        trained_tokens: job.trained_tokens,
      };
    } else if (job.status === STATUS.FAILED || job.status === STATUS.CANCELLED) {
      status = 'failed';
      error = job.error?.message || `OpenAI job ${job.status}`;
      completedAt = new Date().toISOString();
    } else if (job.status === STATUS.RUNNING) {
      status = 'running';
      // Estimate progress based on trained tokens (rough estimate)
      if (job.trained_tokens && job.training_file) {
        progress = Math.min(90, Math.floor((job.trained_tokens / 100000) * 100));
      }
    }

    // Update execution record
    const { error: updateError } = await supabase
      .from('training_executions')
      .update({
        status,
        progress,
        completed_at: completedAt,
        result,
        error,
        updated_at: new Date().toISOString(),
      })
      .eq('id', execution.id);

    if (updateError) {
      console.error('[TrainingStatus] Error updating execution:', updateError);
    } else {
      console.log('[TrainingStatus] Execution updated:', {
        id: execution.id,
        status,
        progress,
      });

      // Record compute time usage when job completes (fire-and-forget)
      if (status === 'completed' && execution.status !== 'completed' && completedAt) {
        const { data: fullExecution } = await supabase
          .from('training_executions')
          .select('created_at, user_id, provider')
          .eq('id', execution.id)
          .single();

        if (fullExecution && fullExecution.created_at) {
          const startTime = new Date(fullExecution.created_at).getTime();
          const endTime = new Date(completedAt).getTime();
          const durationMs = endTime - startTime;
          const durationMinutes = Math.ceil(durationMs / 60000);

          // DEPRECATED: OLD usage tracking system
          // Now using usage_meters table via increment_root_trace_count()
          // recordUsageEvent({
          //   userId: fullExecution.user_id,
          //   metricType: 'compute_minutes',
          //   value: durationMinutes,
          //   resourceType: 'training_job',
          //   resourceId: execution.id,
          //   metadata: {
          //     provider: fullExecution.provider,
          //     openai_job_id: execution.openai_job_id || null,
          //     trained_tokens: job.trained_tokens || 0,
          //     duration_ms: durationMs,
          //     job_type: 'training',
          //   }
          // }).catch(err => {
          //   console.error('[TrainingStatus] Failed to record compute time:', err);
          // });

          console.log('[TrainingStatus] Compute time recorded:', durationMinutes, 'minutes');
        }
      }
    }

    // Return updated status
    const response: TrainingStatusResponse = {
      execution_id: execution.id,
      status,
      progress,
      logs: execution.logs || [],
      error: error || undefined,
      result,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[TrainingStatus] Error syncing OpenAI status:', error);
    const message = error instanceof Error ? error.message : 'Failed to sync with OpenAI';

    // Return current status from database
    const response: TrainingStatusResponse = {
      execution_id: execution.id,
      status: execution.status,
      progress: execution.progress ?? undefined,
      logs: execution.logs || [],
      error: `Failed to sync with OpenAI: ${message}`,
      result: execution.result || undefined,
    };

    return NextResponse.json(response);
  }
}
