import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { imageJobStore } from '@/lib/tools/image-gen/image-job-store';
import {
  imageSseService,
  IMAGE_EVENT_TYPES,
  type ImageStreamEvent,
} from '@/lib/tools/image-gen/image-sse.service';

export const runtime = 'nodejs';

/**
 * SSE endpoint that streams the result of an async image-generation job.
 *
 * OWNER-SCOPED: unlike the research stream, this verifies the caller. EventSource
 * can't set an Authorization header, so the session token is passed as a query
 * param (the pattern used elsewhere for SSE) and the job is read via the
 * owner-scoped `imageJobStore.get(jobId, userId)` — a non-owner / unknown id gets
 * a 404 and never streams.
 */

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function resolveUserId(token: string | null): Promise<string | null> {
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  return user && !error ? user.id : null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  const token = searchParams.get('token') ?? searchParams.get('access_token');

  if (!jobId) {
    return jsonResponse({ error: 'jobId is required' }, 400);
  }

  const userId = await resolveUserId(token);
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // Owner-scoped: null for a non-owner or unknown id.
  const job = await imageJobStore.get(jobId, userId);
  if (!job) {
    return jsonResponse({ error: 'Job not found' }, 404);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let settled = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

      const safeEnqueue = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Controller already closed.
        }
      };

      const finish = (event: Record<string, unknown>) => {
        if (settled) return;
        settled = true;
        safeEnqueue(event);
        imageSseService.off('image_event', handler);
        if (timeoutHandle) clearTimeout(timeoutHandle);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      const handler = (event: ImageStreamEvent) => {
        if (event.jobId !== jobId) return;
        if (event.type === IMAGE_EVENT_TYPES.COMPLETE || event.type === IMAGE_EVENT_TYPES.FAILED) {
          finish(event);
        } else if (!settled) {
          safeEnqueue(event);
        }
      };

      // Subscribe BEFORE re-checking status, so an event firing in the gap is not
      // lost (the completion race: Unsplash can finish before the client connects).
      imageSseService.on('image_event', handler);
      safeEnqueue({ type: IMAGE_EVENT_TYPES.CONNECTED, jobId });

      // Race guard: if the job already reached a terminal state, emit it now.
      const current = await imageJobStore.get(jobId, userId);
      if (current?.status === 'completed') {
        finish({
          type: IMAGE_EVENT_TYPES.COMPLETE,
          jobId,
          status: 'completed',
          url: current.resultUrl,
          source: current.source,
          attribution: current.attribution,
          prompt: current.prompt,
        });
      } else if (current?.status === 'failed') {
        finish({
          type: IMAGE_EVENT_TYPES.FAILED,
          jobId,
          status: 'failed',
          error: current.error,
          prompt: current.prompt,
        });
      }

      request.signal.addEventListener('abort', () => {
        imageSseService.off('image_event', handler);
        if (timeoutHandle) clearTimeout(timeoutHandle);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });

      // Safety close (jobs are bounded well under this). Skip if the job already
      // settled on connect, so we don't arm a lingering timer for a closed stream.
      if (!settled) {
        timeoutHandle = setTimeout(() => {
          imageSseService.off('image_event', handler);
          try {
            controller.close();
          } catch {
            // Already closed.
          }
        }, 10 * 60 * 1000);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
