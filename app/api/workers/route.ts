/**
 * Workers API
 * GET /api/workers - List user's worker agents
 * Date: 2025-12-26
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Helper to get authenticated user
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // online, offline, error
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Workers API] Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query
    let query = supabase
      .from('worker_agents')
      .select('*')
      .eq('user_id', user.id)
      .order('last_heartbeat', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: workers, error } = await query;

    if (error) {
      console.error('[Workers API] Failed to fetch workers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch workers' },
        { status: 500 }
      );
    }

    // Add computed fields
    const workersWithStatus = (workers || []).map((worker) => ({
      ...worker,
      is_online: worker.status === 'online' &&
                 worker.last_heartbeat &&
                 new Date(worker.last_heartbeat).getTime() > Date.now() - 90000, // 90s threshold
      uptime_seconds: worker.last_heartbeat
        ? Math.floor((Date.now() - new Date(worker.registered_at).getTime()) / 1000)
        : 0,
    }));

    return NextResponse.json({ workers: workersWithStatus });
  } catch (err) {
    console.error('[Workers API] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
