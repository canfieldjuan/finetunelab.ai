/**
 * Widget Event Ingest API
 * 
 * Public endpoint for receiving events from embedded widget
 * Handles batched events with JWT authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface WidgetEvent {
  type: string;
  ts: number;
  data: Record<string, unknown>;
  _meta: {
    appId: string;
    sessionId: string;
    page: string;
    userAgent: string;
    sdkVersion: string;
    timestamp: number;
  };
}

interface IngestPayload {
  events: WidgetEvent[];
  user?: {
    id: string;
    traits?: Record<string, unknown>;
  } | null;
}

export async function POST(request: NextRequest) {
  console.log('[Widget Ingest] Request received');

  try {
    // Parse request body
    const payload: IngestPayload = await request.json();
    const { events, user } = payload;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Invalid payload: events array required' },
        { status: 400 }
      );
    }

    console.log('[Widget Ingest] Processing', events.length, 'events');

    // Extract appId from first event (all should have same appId)
    const appId = events[0]?._meta?.appId;
    if (!appId) {
      return NextResponse.json(
        { error: 'Missing appId in event metadata' },
        { status: 400 }
      );
    }

    // Verify app exists and is active
    const { data: app, error: appError } = await supabase
      .from('widget_apps')
      .select('id, is_active, allowed_origins, token_hash')
      .eq('id', appId)
      .single();

    if (appError || !app) {
      console.error('[Widget Ingest] App not found:', appId);
      return NextResponse.json(
        { error: 'Invalid app ID' },
        { status: 401 }
      );
    }

    if (!app.is_active) {
      console.error('[Widget Ingest] App is inactive:', appId);
      return NextResponse.json(
        { error: 'App is inactive' },
        { status: 403 }
      );
    }

    // Verify token (from Authorization header)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const tokenHash = await hashToken(token);

    if (tokenHash !== app.token_hash) {
      console.error('[Widget Ingest] Invalid token');
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Check CORS if origins are configured
    const origin = request.headers.get('Origin');
    if (app.allowed_origins && app.allowed_origins.length > 0 && origin) {
      if (!app.allowed_origins.includes(origin) && !app.allowed_origins.includes('*')) {
        return NextResponse.json(
          { error: 'Origin not allowed' },
          { status: 403 }
        );
      }
    }

    // Process events in a transaction
    const results = await processEvents(appId, events, user);

    console.log('[Widget Ingest] Successfully processed', results.inserted, 'events');

    return NextResponse.json({
      success: true,
      processed: results.inserted,
      sessionId: events[0]._meta.sessionId,
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });

  } catch (error) {
    console.error('[Widget Ingest] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('Origin');
  
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Process events and store in database
 */
async function processEvents(
  appId: string,
  events: WidgetEvent[],
  user?: { id: string; traits?: Record<string, unknown> } | null
): Promise<{ inserted: number }> {
  
  // Group events by session
  const sessionIds = new Set(events.map(e => e._meta.sessionId));
  
  // Ensure sessions exist
  for (const sessionId of sessionIds) {
    const sessionEvent = events.find(e => e._meta.sessionId === sessionId)!;
    
    await supabase
      .from('widget_sessions')
      .upsert({
        id: sessionId,
        app_id: appId,
        external_user_id: user?.id || null,
        user_traits: user?.traits || {},
        initial_page: sessionEvent._meta.page,
        user_agent: sessionEvent._meta.userAgent,
        first_seen_at: new Date(sessionEvent._meta.timestamp).toISOString(),
        last_seen_at: new Date(sessionEvent._meta.timestamp).toISOString(),
      }, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });
  }

  // Insert events
  const eventRows = events.map(event => ({
    app_id: appId,
    session_id: event._meta.sessionId,
    event_type: event.type,
    event_ts: new Date(event.ts).toISOString(),
    received_at: new Date().toISOString(),
    data: event.data,
    page: event._meta.page,
    sdk_version: event._meta.sdkVersion,
  }));

  const { error: eventsError } = await supabase
    .from('widget_events')
    .insert(eventRows);

  if (eventsError) {
    console.error('[Widget Ingest] Error inserting events:', eventsError);
    throw eventsError;
  }

  // Process LLM-specific events for aggregation
  await processLLMEvents(appId, events);

  return { inserted: events.length };
}

/**
 * Process and aggregate LLM request/response events
 */
async function processLLMEvents(appId: string, events: WidgetEvent[]): Promise<void> {
  const llmEvents = events.filter(e => 
    e.type.startsWith('llm:') || e.type.startsWith('user:feedback') || e.type.startsWith('eval:')
  );

  for (const event of llmEvents) {
    const requestId = event.data.requestId as string | undefined;
    if (!requestId) continue;

    if (event.type === 'llm:request') {
      // Create new request record
      await supabase
        .from('widget_llm_requests')
        .upsert({
          id: requestId,
          app_id: appId,
          session_id: event._meta.sessionId,
          provider: event.data.provider as string,
          model: event.data.model as string,
          messages: event.data.messages,
          tools: event.data.tools,
          status: 'pending',
          request_ts: new Date(event.ts).toISOString(),
        }, {
          onConflict: 'id',
          ignoreDuplicates: true,
        });
    } else if (event.type === 'llm:response') {
      // Update with response data
      await supabase
        .from('widget_llm_requests')
        .update({
          output: event.data.output as string,
          tool_calls: event.data.toolCalls,
          input_tokens: event.data.inputTokens as number,
          output_tokens: event.data.outputTokens as number,
          total_tokens: (event.data.inputTokens as number || 0) + (event.data.outputTokens as number || 0),
          latency_ms: event.data.latencyMs as number,
          cost_usd: event.data.costUsd as number,
          status: 'completed',
          response_ts: new Date(event.ts).toISOString(),
        })
        .eq('id', requestId);
    } else if (event.type === 'llm:error') {
      // Update with error
      await supabase
        .from('widget_llm_requests')
        .update({
          status: 'error',
          error_message: event.data.error as string,
          response_ts: new Date(event.ts).toISOString(),
        })
        .eq('id', requestId);
    } else if (event.type === 'user:feedback') {
      // Add user feedback
      await supabase
        .from('widget_llm_requests')
        .update({
          feedback_rating: event.data.rating as number,
          feedback_reason: event.data.reason as string,
          feedback_correction: event.data.correction as string,
        })
        .eq('id', requestId);
    } else if (event.type === 'eval:score') {
      // Add evaluation score
      const { data: existing } = await supabase
        .from('widget_llm_requests')
        .select('eval_scores')
        .eq('id', requestId)
        .single();

      const evalScores = existing?.eval_scores || {};
      evalScores[event.data.name as string] = {
        score: event.data.score,
        details: event.data.details,
        ts: event.ts,
      };

      await supabase
        .from('widget_llm_requests')
        .update({ eval_scores: evalScores })
        .eq('id', requestId);
    }
  }
}

/**
 * Hash token for secure storage (simple SHA-256)
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
