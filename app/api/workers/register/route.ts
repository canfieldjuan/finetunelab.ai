/**
 * Worker Registration API
 * POST /api/workers/register - Register a new worker agent
 * Date: 2025-12-26
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { customAlphabet } from 'nanoid';
import { validateApiKey } from '@/lib/auth/api-key-validator';

export const runtime = 'nodejs';

// Generate worker_id with lowercase alphanumeric characters only (matches DB constraint)
const generateWorkerId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 24);

interface RegisterWorkerRequest {
  api_key: string;
  hostname: string;
  platform: 'windows' | 'darwin' | 'linux';
  version: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

interface RegisterWorkerResponse {
  worker_id: string;
  websocket_url: string;
  heartbeat_interval_seconds: number;
  max_concurrency: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterWorkerRequest = await request.json();

    // Validate required fields
    if (!body.api_key || !body.hostname || !body.platform || !body.version) {
      return NextResponse.json(
        { error: 'Missing required fields: api_key, hostname, platform, version' },
        { status: 400 }
      );
    }

    // Validate platform
    if (!['windows', 'darwin', 'linux'].includes(body.platform)) {
      return NextResponse.json(
        { error: 'Invalid platform. Must be windows, darwin, or linux' },
        { status: 400 }
      );
    }

    // Validate API key format
    if (!body.api_key.startsWith('wak_')) {
      return NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 401 }
      );
    }

    // Get Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Worker Register] Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Validate API key using proper hash verification
    console.log('[Worker Register] Validating API key');
    const validation = await validateApiKey(body.api_key);

    if (!validation.isValid || !validation.userId || !validation.keyId) {
      console.log('[Worker Register] Invalid API key');
      return NextResponse.json(
        { error: 'Invalid or inactive API key' },
        { status: 401 }
      );
    }

    // Check worker scope
    const scopes = validation.scopes || [];
    if (!scopes.includes('worker') && !scopes.includes('all')) {
      console.log('[Worker Register] API key missing worker scope');
      return NextResponse.json(
        { error: 'API key does not have worker scope' },
        { status: 403 }
      );
    }

    // Fetch worker_id from the API key record
    const { data: keyData, error: keyError } = await supabase
      .from('user_api_keys')
      .select('worker_id')
      .eq('id', validation.keyId)
      .single();

    if (keyError) {
      console.error('[Worker Register] Failed to fetch API key data:', keyError);
      return NextResponse.json(
        { error: 'Failed to fetch API key data' },
        { status: 500 }
      );
    }

    // Step 2: Generate worker_id if not already associated
    let workerId = keyData.worker_id;

    if (!workerId) {
      // Generate new worker_id (lowercase alphanumeric only, matches DB constraint)
      workerId = `wkr_${generateWorkerId()}`;

      // Update API key with worker_id
      const { error: updateError } = await supabase
        .from('user_api_keys')
        .update({
          worker_id: workerId,
          worker_metadata: {
            hostname: body.hostname,
            platform: body.platform,
            version: body.version,
            registered_at: new Date().toISOString(),
          },
        })
        .eq('id', validation.keyId);

      if (updateError) {
        console.error('[Worker Register] Failed to update API key:', updateError);
        return NextResponse.json(
          { error: 'Failed to register worker' },
          { status: 500 }
        );
      }
    }

    // Step 3: Check if worker already exists
    const { data: existingWorker } = await supabase
      .from('worker_agents')
      .select('id, worker_id')
      .eq('worker_id', workerId)
      .single();

    if (existingWorker) {
      // Update existing worker
      const { error: updateError } = await supabase
        .from('worker_agents')
        .update({
          hostname: body.hostname,
          platform: body.platform,
          version: body.version,
          capabilities: body.capabilities || [],
          metadata: body.metadata || {},
          status: 'online',
          last_heartbeat: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('worker_id', workerId);

      if (updateError) {
        console.error('[Worker Register] Failed to update worker:', updateError);
        return NextResponse.json(
          { error: 'Failed to update worker' },
          { status: 500 }
        );
      }

      console.log('[Worker Register] Updated existing worker:', workerId);
    } else {
      // Create new worker
      const { error: insertError } = await supabase
        .from('worker_agents')
        .insert({
          worker_id: workerId,
          user_id: validation.userId,
          api_key_id: validation.keyId,
          hostname: body.hostname,
          platform: body.platform,
          version: body.version,
          capabilities: body.capabilities || [],
          metadata: body.metadata || {},
          status: 'online',
          last_heartbeat: new Date().toISOString(),
        });

      if (insertError) {
        console.error('[Worker Register] Failed to insert worker:', insertError);
        return NextResponse.json(
          { error: 'Failed to register worker' },
          { status: 500 }
        );
      }

      console.log('[Worker Register] Registered new worker:', workerId);
    }

    // Step 4: Build response
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.finetunelab.ai';
    const websocketUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');

    const response: RegisterWorkerResponse = {
      worker_id: workerId,
      websocket_url: `${websocketUrl}/api/v1/workers/ws`,
      heartbeat_interval_seconds: 30,
      max_concurrency: 1,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[Worker Register] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
