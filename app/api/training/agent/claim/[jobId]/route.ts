/**
 * Training Agent Claim Endpoint
 * POST /api/training/agent/claim/[jobId]
 *
 * Allows a training agent to claim a pending job for execution.
 * Uses optimistic locking to prevent race conditions with multiple agents.
 *
 * Auth: API key with 'training' scope or session token
 * Headers:
 *   - Authorization: Bearer wak_xxxxx (API key) or Bearer <session_token>
 *   - X-Agent-ID: agent_xxxxx (required - identifies the claiming agent)
 *
 * Returns:
 *   - job_token: Secure token for metrics authentication
 *   - job: Full job details including config
 *
 * Date: 2026-01-07
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateTraining } from '@/lib/auth/training-auth';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params;
  console.log('[Agent Claim] POST request for job:', jobId);

  // Verify Supabase configuration
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Agent Claim] Missing Supabase configuration');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    // Authenticate request
    const authResult = await authenticateTraining(request);
    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const userId = authResult.userId;
    console.log('[Agent Claim] Authenticated user:', userId);

    // Get agent ID from header
    const agentId = request.headers.get('x-agent-id');
    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing X-Agent-ID header' },
        { status: 400 }
      );
    }

    // Validate agent ID format
    if (!agentId.startsWith('agent_') || agentId.length < 10) {
      return NextResponse.json(
        { error: 'Invalid X-Agent-ID format. Expected: agent_xxxxx' },
        { status: 400 }
      );
    }

    console.log('[Agent Claim] Agent ID:', agentId);

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Attempt to claim the job using optimistic locking
    // Only update if: job exists, belongs to user, is pending, and unclaimed
    const { data: claimedJob, error: claimError } = await supabase
      .from('local_training_jobs')
      .update({
        agent_id: agentId,
        claimed_at: new Date().toISOString(),
        status: 'running'
      })
      .eq('id', jobId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .is('agent_id', null)
      .select(`
        id,
        job_token,
        model_name,
        dataset_path,
        config,
        total_epochs,
        total_steps,
        created_at
      `)
      .maybeSingle();

    if (claimError) {
      console.error('[Agent Claim] Database error:', claimError);
      return NextResponse.json(
        { error: 'Failed to claim job' },
        { status: 500 }
      );
    }

    // Job not found or already claimed
    if (!claimedJob) {
      console.log('[Agent Claim] Job not available:', jobId);

      // Check why claim failed
      const { data: existingJob } = await supabase
        .from('local_training_jobs')
        .select('id, status, agent_id, user_id')
        .eq('id', jobId)
        .maybeSingle();

      if (!existingJob) {
        return NextResponse.json(
          { error: 'Job not found', code: 'JOB_NOT_FOUND' },
          { status: 404 }
        );
      }

      if (existingJob.user_id !== userId) {
        return NextResponse.json(
          { error: 'Job belongs to another user', code: 'ACCESS_DENIED' },
          { status: 403 }
        );
      }

      if (existingJob.agent_id) {
        return NextResponse.json(
          { error: 'Job already claimed by another agent', code: 'ALREADY_CLAIMED' },
          { status: 409 }
        );
      }

      if (existingJob.status !== 'pending') {
        return NextResponse.json(
          { error: `Job is not pending (status: ${existingJob.status})`, code: 'INVALID_STATUS' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to claim job', code: 'CLAIM_FAILED' },
        { status: 500 }
      );
    }

    console.log('[Agent Claim] Job claimed successfully:', jobId);

    // Return job details with token
    return NextResponse.json({
      success: true,
      job_token: claimedJob.job_token,
      job: {
        id: claimedJob.id,
        model_name: claimedJob.model_name,
        dataset_path: claimedJob.dataset_path,
        config: claimedJob.config,
        total_epochs: claimedJob.total_epochs,
        total_steps: claimedJob.total_steps,
        created_at: claimedJob.created_at
      }
    });

  } catch (error) {
    console.error('[Agent Claim] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
