/**
 * Server-Sent Events (SSE) Endpoint for Training Predictions
 *
 * Provides real-time updates when new predictions are inserted during training.
 * Eliminates need for polling, reducing server load while providing instant updates.
 *
 * @swagger
 * /api/training/predictions/{jobId}/stream:
 *   get:
 *     summary: Stream real-time prediction updates via SSE
 *     description: |
 *       Establishes a Server-Sent Events connection for live prediction updates.
 *       Sends events when new predictions are inserted, epochs complete, or trends update.
 *
 *       **Event Types:**
 *       - `connected`: Initial connection confirmation
 *       - `prediction`: New prediction inserted
 *       - `heartbeat`: Keep-alive every 15s
 *
 *       **Use Cases:**
 *       - Live training dashboards (W&B-style experience)
 *       - External developers training locally viewing progress in web UI
 *       - Real-time charts updating as predictions arrive
 *     tags:
 *       - Metrics
 *     security:
 *       - apiKey: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Training job ID
 *         example: "sdk_test_1766016238"
 *     responses:
 *       200:
 *         description: SSE stream established
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *             examples:
 *               connected:
 *                 value: |
 *                   event: connected
 *                   data: {"jobId":"sdk_test_1766016238","timestamp":"2025-12-17T12:00:00Z"}
 *
 *               prediction:
 *                 value: |
 *                   event: prediction
 *                   data: {"prediction":{"id":"pred_123","epoch":2,"step":100,...},"total_count":15}
 *
 *               heartbeat:
 *                 value: |
 *                   event: heartbeat
 *                   data: {"timestamp":"2025-12-17T12:00:15Z"}
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Job not found
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateRequestWithScope } from '@/lib/auth/api-key-validator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  console.log('[SSE] Stream request for job:', jobId);

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.error('[SSE] Missing environment variables');
    return new Response('Server configuration error', { status: 500 });
  }

  // ============================================================================
  // AUTHENTICATION (Same pattern as existing endpoints)
  // ============================================================================

  let userId: string | null = null;

  try {
    // Try API key authentication first (for SDK access)
    const apiKeyValidation = await validateRequestWithScope(request.headers, 'training');

    if (apiKeyValidation.isValid && apiKeyValidation.userId) {
      // API key authentication successful
      userId = apiKeyValidation.userId;
      console.log('[SSE] Authenticated via API key:', userId);
    } else {
      // Fall back to bearer token authentication (for web UI)
      const authHeader = request.headers.get('authorization');
      if (!authHeader) {
        console.log('[SSE] No authentication provided');
        return new Response('Unauthorized', { status: 401 });
      }

      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: authError,
      } = await supabaseAuth.auth.getUser();

      if (authError || !user) {
        console.log('[SSE] Bearer token auth failed:', authError?.message);
        return new Response('Unauthorized', { status: 401 });
      }

      userId = user.id;
      console.log('[SSE] Authenticated via bearer token:', userId);
    }
  } catch (authErr) {
    console.error('[SSE] Authentication error:', authErr);
    return new Response('Unauthorized', { status: 401 });
  }

  // ============================================================================
  // VERIFY JOB OWNERSHIP
  // ============================================================================

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: job, error: jobError } = await supabase
    .from('local_training_jobs')
    .select('id, user_id')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single();

  if (jobError || !job) {
    console.log('[SSE] Job not found or access denied:', jobId);
    return new Response('Job not found', { status: 404 });
  }

  console.log('[SSE] Job access verified for user:', userId);

  // ============================================================================
  // CREATE SSE STREAM
  // ============================================================================

  const encoder = new TextEncoder();
  let isConnected = true;

  const stream = new ReadableStream({
    async start(controller) {
      console.log('[SSE] Client connected for job:', jobId);

      // Send initial connection confirmation
      const connectedEvent = `event: connected\ndata: ${JSON.stringify({
        jobId,
        timestamp: new Date().toISOString(),
      })}\n\n`;

      controller.enqueue(encoder.encode(connectedEvent));

      // ========================================================================
      // SUPABASE REALTIME SUBSCRIPTION (Same pattern as TrainingMetricsContext)
      // ========================================================================

      const channel = supabase
        .channel(`predictions-stream-${jobId}-${Date.now()}`, {
          config: {
            broadcast: { self: false },
            presence: { key: '' },
          },
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'training_predictions',
            filter: `job_id=eq.${jobId}`,
          },
          async (payload) => {
            if (!isConnected) return;

            console.log('[SSE] New prediction INSERT event for job:', jobId);

            try {
              // Get total count
              const { count } = await supabase
                .from('training_predictions')
                .select('*', { count: 'exact', head: true })
                .eq('job_id', jobId);

              const predictionEvent = `event: prediction\ndata: ${JSON.stringify({
                prediction: payload.new,
                total_count: count || 0,
                timestamp: new Date().toISOString(),
              })}\n\n`;

              controller.enqueue(encoder.encode(predictionEvent));
              console.log('[SSE] Sent prediction event, total count:', count);
            } catch (err) {
              console.error('[SSE] Error sending prediction event:', err);
            }
          }
        )
        .subscribe((status) => {
          console.log('[SSE] Subscription status:', status);

          if (status === 'SUBSCRIBED') {
            console.log('[SSE] ✅ Realtime subscription active for job:', jobId);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('[SSE] ❌ Subscription error:', status);

            // Send error event to client
            if (isConnected) {
              const errorEvent = `event: error\ndata: ${JSON.stringify({
                error: 'Subscription failed',
                status,
                timestamp: new Date().toISOString(),
              })}\n\n`;
              controller.enqueue(encoder.encode(errorEvent));
            }
          }
        });

      // ========================================================================
      // HEARTBEAT (Keep connection alive)
      // ========================================================================

      const heartbeatInterval = setInterval(() => {
        if (!isConnected) {
          clearInterval(heartbeatInterval);
          return;
        }

        try {
          const heartbeatEvent = `event: heartbeat\ndata: ${JSON.stringify({
            timestamp: new Date().toISOString(),
          })}\n\n`;

          controller.enqueue(encoder.encode(heartbeatEvent));
        } catch (err) {
          console.error('[SSE] Heartbeat error:', err);
          clearInterval(heartbeatInterval);
        }
      }, 15000); // Every 15 seconds

      // ========================================================================
      // CLEANUP ON DISCONNECT
      // ========================================================================

      request.signal.addEventListener('abort', () => {
        console.log('[SSE] Client disconnected for job:', jobId);
        isConnected = false;
        clearInterval(heartbeatInterval);

        // Unsubscribe from Supabase Realtime
        channel.unsubscribe().then(() => {
          console.log('[SSE] Realtime channel unsubscribed');
        });

        controller.close();
      });
    },
  });

  // ============================================================================
  // RETURN SSE RESPONSE
  // ============================================================================

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
