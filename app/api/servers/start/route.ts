/**
 * Server Start API Endpoint
 *
 * POST /api/servers/start
 * Starts a stopped vLLM/Ollama inference server
 *
 * Phase: vLLM Server Management UI - Phase 1
 * Date: 2025-11-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inferenceServerManager } from '@/lib/services/inference-server-manager';
import { STATUS } from '@/lib/constants';

export async function POST(req: NextRequest) {
  console.log('[ServerStart] POST request received');

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
      console.error('[ServerStart] No authorization header provided');
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
      console.error('[ServerStart] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - please login' },
        { status: 401 }
      );
    }

    console.log('[ServerStart] Authenticated user:', user.email);

    // Get server from database (RLS ensures user owns it)
    const { data: server, error: serverError } = await supabase
      .from('local_inference_servers')
      .select('*')
      .eq('id', server_id)
      .eq('user_id', user.id)
      .single();

    if (serverError || !server) {
      console.error('[ServerStart] Server not found:', serverError);
      return NextResponse.json(
        { error: 'Server not found or access denied' },
        { status: 404 }
      );
    }

    console.log('[ServerStart] Found server:', {
      id: server.id,
      name: server.name,
      status: server.status,
      port: server.port
    });

    // Check if already running
    if (server.status === STATUS.RUNNING) {
      // Verify process is actually alive
      if (server.process_id) {
        try {
          process.kill(server.process_id, 0);
          // Process exists, server is already running
          console.log('[ServerStart] Server already running');
          return NextResponse.json({
            success: true,
            server_id: server.id,
            port: server.port,
            status: STATUS.RUNNING,
            message: 'Server is already running'
          });
        } catch {
          // Process dead, continue with restart
          console.log('[ServerStart] Server marked running but process dead, restarting');
        }
      }
    }

    // Check if port is available
    const { data: portConflict } = await supabase
      .from('local_inference_servers')
      .select('id, name')
      .eq('port', server.port)
      .eq('status', STATUS.RUNNING)
      .neq('id', server.id)
      .single();

    if (portConflict) {
      return NextResponse.json(
        {
          error: 'Port already in use',
          details: `Port ${server.port} is used by server "${portConflict.name}". Stop that server first.`
        },
        { status: 409 }
      );
    }

    // Start the server based on type
    console.log('[ServerStart] Starting', server.server_type, 'server...');

    let serverInfo;

    if (server.server_type === STATUS.VLLM) {
      // Start vLLM server with existing configuration
      serverInfo = await inferenceServerManager.startVLLM(
        {
          modelPath: server.model_path,
          modelName: server.model_name,
          gpuMemoryUtilization: server.config_json?.gpu_memory_utilization || 0.8,
          maxModelLen: server.config_json?.max_model_len,
          tensorParallelSize: server.config_json?.tensor_parallel_size || 1,
          dtype: server.config_json?.dtype || 'auto',
          trustRemoteCode: server.config_json?.trust_remote_code || false,
        },
        user.id,
        server.training_job_id,
        supabase
      );
    } else if (server.server_type === STATUS.OLLAMA) {
      // Start Ollama server
      serverInfo = await inferenceServerManager.startOllama(
        {
          modelPath: server.model_path,
          modelName: server.model_name,
          contextLength: server.config_json?.context_length || 4096,
        },
        user.id,
        server.training_job_id,
        supabase
      );
    } else {
      return NextResponse.json(
        { error: 'Unsupported server type' },
        { status: 400 }
      );
    }

    console.log('[ServerStart] Server started:', serverInfo);

    return NextResponse.json({
      success: true,
      server_id: serverInfo.serverId,
      port: serverInfo.port,
      base_url: serverInfo.baseUrl,
      status: STATUS.STARTING,
      message: `Server starting on port ${serverInfo.port}. Will be ready in ~30 seconds.`
    });

  } catch (error) {
    console.error('[ServerStart] Error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: 'Failed to start server',
        details: errorMsg
      },
      { status: 500 }
    );
  }
}
