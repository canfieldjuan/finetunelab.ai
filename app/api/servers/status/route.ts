/**
 * Server Status API Endpoint
 *
 * GET /api/servers/status
 * Returns status of all user's vLLM/Ollama inference servers
 *
 * Phase: vLLM Server Management UI - Phase 1
 * Date: 2025-11-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { STATUS } from '@/lib/constants';

export async function GET(req: NextRequest) {
  console.log('[ServerStatus] GET request received');

  try {
    // Get Authorization header
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[ServerStatus] No authorization header provided');
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
      console.error('[ServerStatus] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - please login' },
        { status: 401 }
      );
    }

    console.log('[ServerStatus] Authenticated user:', user.email);

    // Query local_inference_servers table
    const { data: servers, error: serversError } = await supabase
      .from('local_inference_servers')
      .select(`
        id,
        server_type,
        name,
        base_url,
        port,
        model_path,
        model_name,
        process_id,
        status,
        started_at,
        stopped_at,
        last_health_check,
        config_json,
        metadata
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (serversError) {
      console.error('[ServerStatus] Database error:', serversError);
      return NextResponse.json(
        {
          error: 'Failed to fetch servers',
          details: serversError.message
        },
        { status: 500 }
      );
    }

    console.log('[ServerStatus] Found', servers?.length || 0, 'servers');

    // Check if "running" servers are actually alive
    const serversWithStatus = await Promise.all(
      (servers || []).map(async (server) => {
        let actualStatus = server.status;

        // If server claims to be running or starting, verify the process is actually alive
        if ((server.status === STATUS.RUNNING || server.status === STATUS.STARTING) && server.process_id) {
          try {
            // On Windows, check if process exists
            // process.kill with signal 0 checks existence without killing
            process.kill(server.process_id, 0);
            // Process exists - keep current status
            actualStatus = server.status;
          } catch {
            // Process doesn't exist
            const newStatus = server.status === STATUS.STARTING ? STATUS.ERROR : STATUS.STOPPED;
            console.log(`[ServerStatus] Process ${server.process_id} for server ${server.id} is dead, marking as ${newStatus}`);
            actualStatus = newStatus;

            // Update database to reflect reality
            const updateData: any = {
              status: newStatus,
              stopped_at: new Date().toISOString()
            };

            if (newStatus === STATUS.ERROR) {
              updateData.error_message = 'Process died during startup';
            }

            await supabase
              .from('local_inference_servers')
              .update(updateData)
              .eq('id', server.id);
          }
        }

        // Find corresponding model in llm_models table
        // Match by provider, base_url, AND model_name to handle multiple models on same port
        const { data: modelData } = await supabase
          .from('llm_models')
          .select('id, name')
          .eq('user_id', user.id)
          .eq('provider', server.server_type)
          .eq('base_url', server.base_url)
          .eq('name', server.model_name)
          .single();

        return {
          id: server.id,
          server_type: server.server_type,
          model_id: modelData?.id || null, // Link to llm_models table
          model_name: server.model_name,
          display_name: server.name,
          status: actualStatus,
          port: server.port,
          base_url: server.base_url,
          process_id: server.process_id,
          started_at: server.started_at,
          stopped_at: server.stopped_at,
          last_health_check: server.last_health_check
        };
      })
    );

    return NextResponse.json({
      success: true,
      servers: serversWithStatus
    });

  } catch (error) {
    console.error('[ServerStatus] Unexpected error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: errorMsg
      },
      { status: 500 }
    );
  }
}
