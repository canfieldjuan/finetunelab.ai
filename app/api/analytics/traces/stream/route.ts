/**
 * Real-time trace streaming endpoint using Server-Sent Events (SSE)
 *
 * Streams new trace events as they occur in real-time
 * Phase: Live Trace Streaming
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface RealtimePayload {
  new: {
    id: string;
    [key: string]: unknown;
  };
  old?: {
    [key: string]: unknown;
  };
}

/**
 * GET - Stream trace updates via SSE
 */
export async function GET(req: NextRequest) {
  console.log('[Traces Stream] Connection requested');

  try {
    // Authenticate user - support both header and query param (for SSE compatibility)
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    const tokenParam = searchParams.get('token');

    const token = authHeader?.replace('Bearer ', '') || tokenParam;

    if (!token) {
      console.error('[Traces Stream] No authorization token');
      return new Response('Unauthorized: Missing token', { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('[Traces Stream] Authentication failed:', userError);
      return new Response('Unauthorized', { status: 401 });
    }

    console.log('[Traces Stream] Authenticated user:', user.id);

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connection success message
        const initialMessage = {
          type: 'connected',
          timestamp: new Date().toISOString(),
          message: 'Live trace streaming connected'
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialMessage)}\n\n`));
        console.log('[Traces Stream] Connection established for user:', user.id);

        // Set up Supabase Realtime subscription
        const channel = supabase
          .channel(`traces-stream-${user.id}-${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'llm_traces',
              filter: `user_id=eq.${user.id}`,
            },
            (payload: RealtimePayload) => {
              console.log('[Traces Stream] New trace detected:', payload.new.id);

              // Send trace data to client
              const traceEvent = {
                type: 'trace',
                timestamp: new Date().toISOString(),
                data: payload.new
              };

              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(traceEvent)}\n\n`));
                console.log('[Traces Stream] Trace event sent to client');
              } catch (error) {
                console.error('[Traces Stream] Error sending trace event:', error);
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'llm_traces',
              filter: `user_id=eq.${user.id}`,
            },
            (payload: RealtimePayload) => {
              console.log('[Traces Stream] Trace updated:', payload.new.id);

              // Send update event
              const updateEvent = {
                type: 'trace_update',
                timestamp: new Date().toISOString(),
                data: payload.new
              };

              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(updateEvent)}\n\n`));
              } catch (error) {
                console.error('[Traces Stream] Error sending update event:', error);
              }
            }
          )
          .subscribe((status: unknown, err: unknown) => {
            if (status === 'SUBSCRIBED') {
              console.log('[Traces Stream] Realtime subscription active');

              // Send subscription confirmation
              const subMessage = {
                type: 'subscribed',
                timestamp: new Date().toISOString(),
                message: 'Subscribed to trace updates'
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(subMessage)}\n\n`));
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              console.error('[Traces Stream] Subscription error:', status, err);

              // Send error event
              const errorMessage = {
                type: 'error',
                timestamp: new Date().toISOString(),
                message: `Subscription ${status.toLowerCase()}: ${err || 'Unknown error'}`
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`));
            }
          });

        // Keep-alive ping every 30 seconds
        const keepAliveInterval = setInterval(() => {
          try {
            const pingMessage = {
              type: 'ping',
              timestamp: new Date().toISOString()
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(pingMessage)}\n\n`));
          } catch (error) {
            console.error('[Traces Stream] Keep-alive ping failed:', error);
            clearInterval(keepAliveInterval);
          }
        }, 30000);

        // Cleanup on connection close
        req.signal.addEventListener('abort', () => {
          console.log('[Traces Stream] Client disconnected');
          clearInterval(keepAliveInterval);
          channel.unsubscribe();
          supabase.removeChannel(channel);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('[Traces Stream] Stream error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Stream failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
