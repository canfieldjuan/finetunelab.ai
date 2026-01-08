/**
 * Training Agents List Endpoint
 * GET /api/training/agents
 *
 * Returns all training agents for the authenticated user with their status.
 * Agent status is computed from last_poll_at timestamp.
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

// Agent is considered online if it polled within this many seconds
const ONLINE_THRESHOLD_SECONDS = 60;

export async function GET(request: NextRequest) {
  console.log('[Training Agents] GET request received');

  // Verify Supabase configuration
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Training Agents] Missing Supabase configuration');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[Training Agents] Auth error:', authError?.message);
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    console.log('[Training Agents] Authenticated user:', user.id);

    // Query training agents for this user
    const { data: agents, error: queryError } = await supabase
      .from('training_agents')
      .select('*')
      .eq('user_id', user.id)
      .order('registered_at', { ascending: false });

    if (queryError) {
      console.error('[Training Agents] Query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch agents' },
        { status: 500 }
      );
    }

    // Compute online status based on last_poll_at
    const now = new Date();
    const agentsWithStatus = (agents || []).map(agent => {
      let isOnline = false;
      if (agent.last_poll_at) {
        const lastPoll = new Date(agent.last_poll_at);
        const diffSeconds = (now.getTime() - lastPoll.getTime()) / 1000;
        isOnline = diffSeconds <= ONLINE_THRESHOLD_SECONDS;
      }

      return {
        ...agent,
        status: isOnline ? 'online' : 'offline',
        is_online: isOnline,
      };
    });

    console.log('[Training Agents] Returning', agentsWithStatus.length, 'agents');

    return NextResponse.json({
      agents: agentsWithStatus,
      online_threshold_seconds: ONLINE_THRESHOLD_SECONDS
    });

  } catch (error) {
    console.error('[Training Agents] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
