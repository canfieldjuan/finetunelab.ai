/**
 * Training Agent Detail Endpoint
 * GET/DELETE /api/training/agents/[agentId]
 *
 * GET: Returns details for a specific training agent
 * DELETE: Removes a training agent record
 *
 * Auth: Session token (Bearer) required
 *
 * Date: 2026-01-07
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ONLINE_THRESHOLD_SECONDS = 60;

interface RouteParams {
  params: Promise<{ agentId: string }>;
}

async function authenticateUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header', status: 401 };
  }

  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { error: 'Invalid or expired token', status: 401 };
  }

  return { user, supabase };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { agentId } = await params;
  console.log('[Training Agent] GET request for:', agentId);

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    const auth = await authenticateUser(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { user, supabase } = auth;

    // Query agent by agent_id (not UUID id)
    const { data: agent, error: queryError } = await supabase
      .from('training_agents')
      .select('*')
      .eq('user_id', user.id)
      .eq('agent_id', agentId)
      .maybeSingle();

    if (queryError) {
      console.error('[Training Agent] Query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch agent' },
        { status: 500 }
      );
    }

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Compute online status
    let isOnline = false;
    if (agent.last_poll_at) {
      const lastPoll = new Date(agent.last_poll_at);
      const now = new Date();
      const diffSeconds = (now.getTime() - lastPoll.getTime()) / 1000;
      isOnline = diffSeconds <= ONLINE_THRESHOLD_SECONDS;
    }

    // Get job stats for this agent
    const { data: jobStats, error: statsError } = await supabase
      .from('local_training_jobs')
      .select('id, status')
      .eq('agent_id', agentId);

    const stats = {
      total_jobs: jobStats?.length || 0,
      completed_jobs: jobStats?.filter(j => j.status === 'completed').length || 0,
      running_jobs: jobStats?.filter(j => j.status === 'running').length || 0,
    };

    return NextResponse.json({
      agent: {
        ...agent,
        status: isOnline ? 'online' : 'offline',
        is_online: isOnline,
        ...stats
      }
    });

  } catch (error) {
    console.error('[Training Agent] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { agentId } = await params;
  console.log('[Training Agent] DELETE request for:', agentId);

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    const auth = await authenticateUser(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { user, supabase } = auth;

    // Delete agent record
    const { error: deleteError } = await supabase
      .from('training_agents')
      .delete()
      .eq('user_id', user.id)
      .eq('agent_id', agentId);

    if (deleteError) {
      console.error('[Training Agent] Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete agent' },
        { status: 500 }
      );
    }

    console.log('[Training Agent] Deleted agent:', agentId);

    return NextResponse.json({
      success: true,
      message: 'Agent deleted successfully'
    });

  } catch (error) {
    console.error('[Training Agent] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
