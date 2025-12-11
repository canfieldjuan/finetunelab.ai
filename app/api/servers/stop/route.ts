/**
 * Server Stop API Endpoint
 *
 * POST /api/servers/stop
 * Stops a running vLLM/Ollama inference server
 *
 * Phase: vLLM Server Management UI - Phase 1
 * Date: 2025-11-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inferenceServerManager } from '@/lib/services/inference-server-manager';
import { STATUS } from '@/lib/constants';

export async function POST(req: NextRequest) {
  console.log('[ServerStop] POST request received');

  try {
    // Parse request body
    const body = await req.json();
    const { server_id } = body;

    if (!server_id) {
      return NextResponse.json(
        { error: 'Missing required field: server_id' },
        { status: 400 }
      );
    }

    // Get Authorization header
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[ServerStop] No authorization header provided');
      return NextResponse.json(
        { error: 'Unauthorized - Authorization header required' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[ServerStop] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - please login' },
        { status: 401 }
      );
    }

    console.log('[ServerStop] Authenticated user:', user.email);

    // Get server from database (RLS ensures user owns it)
    const { data: server, error: serverError } = await supabase
      .from('local_inference_servers')
      .select('*')
      .eq('id', server_id)
      .eq('user_id', user.id)
      .single();

    if (serverError || !server) {
      console.error('[ServerStop] Server not found:', serverError);
      return NextResponse.json(
        { error: 'Server not found or access denied' },
        { status: 404 }
      );
    }

    console.log('[ServerStop] Found server:', {
      id: server.id,
      name: server.name,
      status: server.status,
      port: server.port
    });

    // Check if already stopped (idempotent)
    if (server.status === STATUS.STOPPED) {
      console.log('[ServerStop] Server already stopped');
      return NextResponse.json({
        success: true,
        server_id: server.id,
        status: STATUS.STOPPED,
        message: 'Server is already stopped'
      });
    }

    // If server is running, verify process is actually alive
    if (server.status === STATUS.RUNNING && server.process_id) {
      try {
        // Check if process exists
        process.kill(server.process_id, 0);
        console.log('[ServerStop] Process is alive, proceeding with stop');
      } catch {
        // Process is already dead, just update database
        console.log('[ServerStop] Process already dead, updating database');
        await supabase
          .from('local_inference_servers')
          .update({
            status: STATUS.STOPPED,
            stopped_at: new Date().toISOString()
          })
          .eq('id', server.id);

        return NextResponse.json({
          success: true,
          server_id: server.id,
          status: STATUS.STOPPED,
          message: 'Server was already stopped (process not found)'
        });
      }
    }

    // Stop the server
    console.log('[ServerStop] Stopping server...');
    await inferenceServerManager.stopServer(server_id, user.id);

    console.log('[ServerStop] Server stopped successfully');

    return NextResponse.json({
      success: true,
      server_id: server.id,
      status: STATUS.STOPPED,
      message: 'Server stopped successfully'
    });

  } catch (error) {
    console.error('[ServerStop] Error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: 'Failed to stop server',
        details: errorMsg
      },
      { status: 500 }
    );
  }
}
