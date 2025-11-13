/**
 * DAG Logs Endpoint (Server-Sent Events)
 * 
 * GET /api/training/dag/logs/[id] - Stream real-time logs for a DAG execution
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: executionId } = await params;

  if (!executionId) {
    return new Response('Missing execution ID', { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response('Database configuration error', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`[DAG-LOGS] Starting log stream for execution: ${executionId}`);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastTimestamp = new Date(0).toISOString();
      let isComplete = false;
      let intervalId: NodeJS.Timeout | null = null;

      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      const fetchLogs = async () => {
        try {
          const { data: execution } = await supabase
            .from('training_jobs')
            .select('status, jobs')
            .eq('id', executionId)
            .single();

          if (!execution) {
            sendEvent('error', { message: 'Execution not found' });
            controller.close();
            return;
          }

          if (execution.status === 'completed' || execution.status === 'failed' || execution.status === 'cancelled') {
            isComplete = true;
          }

          const { data: newMetrics } = await supabase
            .from('training_metrics')
            .select('*')
            .eq('job_id', executionId)
            .gt('timestamp', lastTimestamp)
            .order('timestamp', { ascending: true });

          if (newMetrics && newMetrics.length > 0) {
            newMetrics.forEach(metric => {
              if (metric.metadata && metric.metadata.logs) {
                const logs = Array.isArray(metric.metadata.logs) ? metric.metadata.logs : [metric.metadata.logs];
                logs.forEach((log: string) => {
                  sendEvent('log', { 
                    timestamp: metric.timestamp,
                    message: log,
                    metricName: metric.metric_name,
                  });
                });
              }
            });

            lastTimestamp = newMetrics[newMetrics.length - 1].timestamp;
          }

          sendEvent('status', {
            status: execution.status,
            jobs: execution.jobs,
            timestamp: new Date().toISOString(),
          });

          if (isComplete) {
            sendEvent('complete', {
              status: execution.status,
              message: 'Execution completed',
            });
            if (intervalId) clearInterval(intervalId);
            controller.close();
          }

        } catch (error) {
          console.error('[DAG-LOGS] Error fetching logs:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          sendEvent('error', { message: errorMessage });
        }
      };

      await fetchLogs();

      intervalId = setInterval(fetchLogs, 2000);

      request.signal.addEventListener('abort', () => {
        console.log(`[DAG-LOGS] Client disconnected from stream: ${executionId}`);
        if (intervalId) clearInterval(intervalId);
        controller.close();
      });
    },

    cancel() {
      console.log(`[DAG-LOGS] Stream cancelled for execution: ${executionId}`);
      // intervalId is now scoped to start(), so cancel() doesn't need to clear it
      // The abort listener above handles cleanup
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
