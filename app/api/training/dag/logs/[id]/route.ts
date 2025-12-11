/**
 * DAG Logs Endpoint (Server-Sent Events)
 * 
 * GET /api/training/dag/logs/[id] - Stream real-time logs for a DAG execution
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { STATUS } from '@/lib/constants';

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

  type TrainingJobRow = {
    status: string;
    jobs: Array<{ status: string }> | null;
  };

  type TrainingMetricRow = {
    timestamp: string;
    metric_name: string;
    metadata?: {
      logs?: string | string[];
    } | null;
  };

  const stream = new ReadableStream({
    async start(controller) {
      let lastTimestamp = new Date(0).toISOString();
      let isComplete = false;
      let intervalId: NodeJS.Timeout | null = null;

      const sendEvent = (event: string, data: Record<string, unknown>) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      const fetchLogs = async () => {
        try {
          const { data: execution } = await supabase
            .from('training_jobs')
            .select('status, jobs')
            .eq('id', executionId)
            .single<TrainingJobRow>();

          if (!execution) {
            sendEvent('error', { message: 'Execution not found' });
            controller.close();
            return;
          }

          if (execution.status === STATUS.COMPLETED || execution.status === STATUS.FAILED || execution.status === STATUS.CANCELLED) {
            isComplete = true;
          }

          const { data: newMetrics } = await supabase
            .from('training_metrics')
            .select('*')
            .eq('job_id', executionId)
            .gt('timestamp', lastTimestamp)
            .order('timestamp', { ascending: true });

          const metrics = newMetrics as TrainingMetricRow[] | null;
          if (metrics && metrics.length > 0) {
            metrics.forEach((metric) => {
              const logs = metric.metadata?.logs;
              if (logs) {
                const normalizedLogs = Array.isArray(logs) ? logs : [logs];
                normalizedLogs.forEach((log) => {
                  sendEvent('log', { 
                    timestamp: metric.timestamp,
                    message: log,
                    metricName: metric.metric_name,
                  });
                });
              }
            });

            lastTimestamp = metrics[metrics.length - 1].timestamp;
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

      intervalId = setInterval(fetchLogs, parseInt(process.env.TRAINING_DAG_LOGS_POLL_INTERVAL_MS || '2000', 10));

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
