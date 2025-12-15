/**
 * Server Status API Endpoint
 *
 * GET /api/servers/status
 * Returns status of all user's vLLM/Ollama inference servers
 *
 * Phase: vLLM Server Management UI - Phase 1
 * Date: 2025-11-02
 * Updated: 2025-12-14 - Added Redis caching for DB queries
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { STATUS } from '@/lib/constants';
import { cacheGet, cacheSet, generateCacheKey } from '@/lib/cache/redis-cache';

// Cache TTL for server data (15 seconds - status can change frequently)
// Note: Process checks still happen live after cache retrieval
const SERVERS_CACHE_TTL_MS = parseInt(process.env.SERVERS_CACHE_TTL_MS || '15000', 10);
const CACHE_PREFIX = 'api:servers';

// Type for cached server data (before process check)
interface CachedServerData {
  servers: Array<{
    id: string;
    server_type: string;
    name: string;
    base_url: string;
    port: number;
    model_path: string;
    model_name: string;
    process_id: number | null;
    status: string;
    started_at: string | null;
    stopped_at: string | null;
    last_health_check: string | null;
  }>;
  modelLookup: Record<string, { id: string; name: string }>;
}

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

    // Generate cache key for this user
    const cacheKey = generateCacheKey(CACHE_PREFIX, user.id);

    // Try to get cached server data (DB results only, process checks happen live)
    let cachedData = await cacheGet<CachedServerData>(cacheKey);
    let fromCache = false;

    if (!cachedData) {
      // Cache miss - fetch from database
      console.log('[ServerStatus] Cache MISS, fetching from database');

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

      // Batch fetch all user's models once (instead of N+1 queries per server)
      const { data: allModels } = await supabase
        .from('llm_models')
        .select('id, name, provider, base_url')
        .eq('user_id', user.id);

      // Create lookup map for O(1) model matching
      const modelLookupObj: Record<string, { id: string; name: string }> = {};
      (allModels || []).forEach((model: { id: string; name: string; provider: string; base_url: string }) => {
        const key = `${model.provider}|${model.base_url}|${model.name}`;
        modelLookupObj[key] = { id: model.id, name: model.name };
      });

      // Cache the DB results
      cachedData = {
        servers: (servers || []).map(s => ({
          id: s.id,
          server_type: s.server_type,
          name: s.name,
          base_url: s.base_url,
          port: s.port,
          model_path: s.model_path,
          model_name: s.model_name,
          process_id: s.process_id,
          status: s.status,
          started_at: s.started_at,
          stopped_at: s.stopped_at,
          last_health_check: s.last_health_check,
        })),
        modelLookup: modelLookupObj,
      };

      await cacheSet(cacheKey, cachedData, SERVERS_CACHE_TTL_MS);
      console.log('[ServerStatus] Cached', cachedData.servers.length, 'servers');
    } else {
      fromCache = true;
      console.log('[ServerStatus] Cache HIT, got', cachedData.servers.length, 'servers');
    }

    console.log('[ServerStatus] Found', cachedData.servers.length, 'servers');

    // Convert lookup object back to Map for processing
    const modelLookup = new Map<string, { id: string; name: string }>(
      Object.entries(cachedData.modelLookup)
    );

    // Process servers - check status and match models (process checks happen LIVE, not cached)
    const deadServerIds: string[] = [];
    const serversWithStatus = cachedData.servers.map((server) => {
      let actualStatus = server.status;

      // If server claims to be running or starting, verify the process is actually alive
      if ((server.status === STATUS.RUNNING || server.status === STATUS.STARTING) && server.process_id) {
        try {
          // process.kill with signal 0 checks existence without killing
          process.kill(server.process_id, 0);
          // Process exists - keep current status
          actualStatus = server.status;
        } catch {
          // Process doesn't exist
          const newStatus = server.status === STATUS.STARTING ? STATUS.ERROR : STATUS.STOPPED;
          console.log(`[ServerStatus] Process ${server.process_id} for server ${server.id} is dead, marking as ${newStatus}`);
          actualStatus = newStatus;
          deadServerIds.push(server.id);
        }
      }

      // Find corresponding model using lookup map (O(1) instead of DB query)
      const lookupKey = `${server.server_type}|${server.base_url}|${server.model_name}`;
      const modelData = modelLookup.get(lookupKey);

      return {
        id: server.id,
        server_type: server.server_type,
        model_id: modelData?.id || null,
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
    });

    // Batch update dead servers in background (don't await - fire and forget)
    if (deadServerIds.length > 0) {
      (async () => {
        try {
          await supabase
            .from('local_inference_servers')
            .update({
              status: STATUS.STOPPED,
              stopped_at: new Date().toISOString()
            })
            .in('id', deadServerIds);
          console.log(`[ServerStatus] Updated ${deadServerIds.length} dead servers`);
        } catch (err) {
          console.error('[ServerStatus] Failed to update dead servers:', err);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      servers: serversWithStatus,
      fromCache,
    }, {
      headers: {
        'X-Cache': fromCache ? 'HIT' : 'MISS',
      },
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
