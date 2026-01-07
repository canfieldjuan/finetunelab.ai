/**
 * Training Agent Poll Endpoint
 * GET /api/training/agent/poll
 *
 * Allows training agents to poll for pending jobs assigned to the authenticated user.
 * Returns the next unclaimed pending job or null if none available.
 *
 * Auth: API key with 'training' scope or session token
 * Headers:
 *   - Authorization: Bearer wak_xxxxx (API key) or Bearer <session_token>
 *   - X-Agent-ID: agent_xxxxx (required - identifies the polling agent)
 *
 * Date: 2026-01-07
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateTraining } from '@/lib/auth/training-auth';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_POLL_INTERVAL_SECONDS = 10;

export async function GET(request: NextRequest) {
  console.log('[Agent Poll] GET request received');

  // Verify Supabase configuration
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Agent Poll] Missing Supabase configuration');
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
    console.log('[Agent Poll] Authenticated user:', userId, 'mode:', authResult.mode);

    // Get agent ID from header
    const agentId = request.headers.get('x-agent-id');
    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing X-Agent-ID header' },
        { status: 400 }
      );
    }

    // Validate agent ID format (agent_xxxx)
    if (!agentId.startsWith('agent_') || agentId.length < 10) {
      return NextResponse.json(
        { error: 'Invalid X-Agent-ID format. Expected: agent_xxxxx' },
        { status: 400 }
      );
    }

    console.log('[Agent Poll] Agent ID:', agentId);

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query for next pending unclaimed job for this user
    // Order by created_at to get oldest pending job first (FIFO)
    const { data: job, error: queryError } = await supabase
      .from('local_training_jobs')
      .select(`
        id,
        model_name,
        dataset_path,
        config,
        total_epochs,
        total_steps,
        created_at,
        job_token
      `)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .is('agent_id', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error('[Agent Poll] Query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to query pending jobs' },
        { status: 500 }
      );
    }

    // No pending jobs
    if (!job) {
      console.log('[Agent Poll] No pending jobs for user:', userId);
      return NextResponse.json({
        job: null,
        poll_interval_seconds: DEFAULT_POLL_INTERVAL_SECONDS,
        message: 'No pending jobs available'
      });
    }

    console.log('[Agent Poll] Found pending job:', job.id);

    // Return job details (without claiming - agent must call claim endpoint)
    // We don't include job_token here - it's returned on claim
    return NextResponse.json({
      job: {
        id: job.id,
        model_name: job.model_name,
        dataset_path: job.dataset_path,
        config: job.config,
        total_epochs: job.total_epochs,
        total_steps: job.total_steps,
        created_at: job.created_at
      },
      poll_interval_seconds: DEFAULT_POLL_INTERVAL_SECONDS
    });

  } catch (error) {
    console.error('[Agent Poll] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
