/**
 * Update Training Parameters API
 * PATCH /api/training/local/[jobId]/update-params
 *
 * Purpose: Modify learning rate, batch size during active training
 * Phase 1: Advanced Training Features - Runtime Parameter Modification API
 * Date: 2025-11-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('[UpdateParams] Module loaded');

/**
 * PATCH handler - Update training parameters during runtime
 * Accepts: { learning_rate?, batch_size?, gradient_accumulation_steps?, warmup_steps? }
 * Returns: { success, updates, applied_at }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  // Await params per Next.js 15 requirements
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  console.log('[UpdateParams] PATCH request received for job:', jobId);

  // Environment validation
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[UpdateParams] CRITICAL: Missing Supabase environment variables');
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials' },
      { status: 500 }
    );
  }

  try {
    // Authentication - verify user is logged in
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.log('[UpdateParams] No authorization header provided');
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.log('[UpdateParams] Authentication failed:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[UpdateParams] User authenticated:', user.id);

    // Parse request body
    const body = await request.json();
    const {
      learning_rate,
      batch_size,
      gradient_accumulation_steps,
      warmup_steps,
    } = body;

    // Validate at least one parameter is being updated
    if (
      learning_rate === undefined &&
      batch_size === undefined &&
      gradient_accumulation_steps === undefined &&
      warmup_steps === undefined
    ) {
      console.log('[UpdateParams] No parameters specified for update');
      return NextResponse.json(
        {
          error: 'No parameters specified',
          allowed_params: ['learning_rate', 'batch_size', 'gradient_accumulation_steps', 'warmup_steps']
        },
        { status: 400 }
      );
    }

    console.log('[UpdateParams] Parameters to update:', body);

    // Use service role key for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get job from database
    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id) // Ensure user owns this job
      .single();

    if (jobError || !job) {
      console.error('[UpdateParams] Job query error:', jobError);
      return NextResponse.json(
        { error: 'Training job not found' },
        { status: 404 }
      );
    }

    console.log('[UpdateParams] Job found:', job.id, 'Status:', job.status);

    // Verify job is running
    if (job.status !== 'running') {
      console.log('[UpdateParams] Job not running:', job.status);
      return NextResponse.json(
        {
          error: 'Can only update parameters for running jobs',
          current_status: job.status
        },
        { status: 400 }
      );
    }

    // Create parameter update record
    const parameterUpdate = {
      learning_rate,
      batch_size,
      gradient_accumulation_steps,
      warmup_steps,
      requested_at: new Date().toISOString(),
      requested_by: user.id,
    };

    // Get current parameter_updates array
    const currentUpdates = job.parameter_updates || [];
    const updatedParameterUpdates = [...currentUpdates, parameterUpdate];

    // Update database with new parameter update
    const { error: updateError } = await supabase
      .from('local_training_jobs')
      .update({
        parameter_updates: updatedParameterUpdates,
        last_parameter_update_at: parameterUpdate.requested_at,
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('[UpdateParams] Failed to update database:', updateError);
      return NextResponse.json(
        {
          error: 'Failed to record parameter update',
          details: updateError.message
        },
        { status: 500 }
      );
    }

    console.log('[UpdateParams] Database updated successfully');

    // TODO: Send parameter update to FastAPI backend
    // This requires backend support for runtime parameter modification
    // For now, we just record the update in database

    console.log('[UpdateParams] Parameter update successful');

    return NextResponse.json({
      success: true,
      updates: parameterUpdate,
      applied_at: parameterUpdate.requested_at,
      message: 'Parameter update recorded (backend support pending)',
    }, { status: 200 });

  } catch (error) {
    console.error('[UpdateParams] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process parameter update',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
