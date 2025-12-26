/**
 * Worker Details API
 * GET /api/workers/{workerId} - Get worker details
 * DELETE /api/workers/{workerId} - Delete worker
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  try {
    const { workerId } = await params;

    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Worker Details] Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch worker
    const { data: worker, error } = await supabase
      .from('worker_agents')
      .select('*')
      .eq('worker_id', workerId)
      .eq('user_id', user.id)
      .single();

    if (error || !worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    // Fetch recent metrics (last 10)
    const { data: metrics } = await supabase
      .from('worker_metrics')
      .select('*')
      .eq('worker_id', workerId)
      .order('timestamp', { ascending: false })
      .limit(10);

    // Fetch recent commands (last 20)
    const { data: commands } = await supabase
      .from('worker_commands')
      .select('*')
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      worker: {
        ...worker,
        is_online:
          worker.status === 'online' &&
          worker.last_heartbeat &&
          new Date(worker.last_heartbeat).getTime() > Date.now() - 90000,
      },
      metrics: metrics || [],
      commands: commands || [],
    });
  } catch (err) {
    console.error('[Worker Details] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  try {
    const { workerId } = await params;

    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Worker Delete] Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify worker belongs to user
    const { data: worker, error: fetchError } = await supabase
      .from('worker_agents')
      .select('id, user_id')
      .eq('worker_id', workerId)
      .single();

    if (fetchError || !worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    if (worker.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Worker does not belong to user' },
        { status: 403 }
      );
    }

    // Delete worker (cascades to commands and metrics)
    const { error: deleteError } = await supabase
      .from('worker_agents')
      .delete()
      .eq('worker_id', workerId);

    if (deleteError) {
      console.error('[Worker Delete] Failed to delete worker:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete worker' },
        { status: 500 }
      );
    }

    console.log('[Worker Delete] Deleted worker:', workerId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Worker Delete] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
