/**
 * Worker Command Result API
 * POST /api/workers/commands/{commandId}/result - Report command execution result
 * Date: 2025-12-26
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateWorkerApiKey } from '@/lib/auth/worker-auth';

export const runtime = 'nodejs';

interface CommandResultRequest {
  status: 'completed' | 'failed' | 'timeout';
  output?: string;
  error?: string;
  data?: Record<string, unknown>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { commandId: string } }
) {
  try {
    const { commandId } = params;

    // Authenticate worker using API key
    const auth = await authenticateWorkerApiKey(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Parse request body
    const body: CommandResultRequest = await request.json();

    // Validate required fields
    if (!body.status) {
      return NextResponse.json(
        { error: 'Missing required field: status' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['completed', 'failed', 'timeout'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Get Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Command Result] Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch command to verify it belongs to this worker
    const { data: command, error: fetchError } = await supabase
      .from('worker_commands')
      .select('id, worker_id, command_type, status')
      .eq('id', commandId)
      .single();

    if (fetchError || !command) {
      return NextResponse.json(
        { error: 'Command not found' },
        { status: 404 }
      );
    }

    // Verify worker_id matches
    if (command.worker_id !== auth.workerId) {
      return NextResponse.json(
        { error: 'Command does not belong to this worker' },
        { status: 403 }
      );
    }

    // Don't update if already completed/failed/timeout
    if (['completed', 'failed', 'timeout'].includes(command.status)) {
      console.log('[Command Result] Command already in terminal state:', command.status);
      return NextResponse.json({
        ok: true,
        message: 'Command already completed',
      });
    }

    // Update command with result
    const { error: updateError } = await supabase
      .from('worker_commands')
      .update({
        status: body.status,
        result: body.data || null,
        error_message: body.error || null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', commandId);

    if (updateError) {
      console.error('[Command Result] Failed to update command:', updateError);
      return NextResponse.json(
        { error: 'Failed to update command result' },
        { status: 500 }
      );
    }

    // Update worker stats
    if (body.status === 'completed') {
      await supabase
        .from('worker_agents')
        .update({
          total_commands_executed: supabase.sql`total_commands_executed + 1`,
          last_command_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('worker_id', auth.workerId);
    } else if (body.status === 'failed') {
      await supabase
        .from('worker_agents')
        .update({
          total_errors: supabase.sql`total_errors + 1`,
          last_command_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('worker_id', auth.workerId);
    }

    console.log('[Command Result] Updated command result:', {
      command_id: commandId,
      worker_id: auth.workerId,
      status: body.status,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Command Result] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
