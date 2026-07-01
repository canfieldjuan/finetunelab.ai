import { NextRequest } from 'next/server';
import { imageJobStore } from '@/lib/tools/image-gen/image-job-store';
import { verifyImageStreamToken } from '@/lib/tools/image-gen/stream-token';
import {
  imageSseService,
  IMAGE_EVENT_TYPES,
  type ImageStreamEvent,
} from '@/lib/tools/image-gen/image-sse.service';

export const runtime = 'nodejs';

/** How often to poll the persisted job status for terminal state. */
const IMAGE_STREAM_POLL_MS = 1500;

/**
 * SSE endpoint that streams the result of an async image-generation job.
 *
 * OWNER-SCOPED via a short-lived, job-scoped token (NOT the Supabase session
 * token — see the #72 review). EventSource can't set an Authorization header, so
 * the token rides the query string; it is signed and bound to (jobId, userId)
 * with a minutes-TTL, so a leaked URL exposes one image stream until it expires,
 * not the account. The job is then read via the owner-scoped
 * `imageJobStore.get(jobId, userId)`, so a non-owner / unknown id gets a 404.
 */

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  const token = searchParams.get('token');

  if (!jobId) {
    return jsonResponse({ error: 'jobId is required' }, 400);
  }

  const claims = verifyImageStreamToken(token);
  if (!claims) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  // The token is bound to a specific job; reject a token minted for a different one.
  if (claims.jobId !== jobId) {
    return jsonResponse({ error: 'Job not found' }, 404);
  }
  const userId = claims.userId;

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
      let pollHandle: ReturnType<typeof setInterval> | undefined;

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
        if (pollHandle) clearInterval(pollHandle);
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

      // Authoritative delivery: poll the persisted job status. The EventEmitter
      // above is only a fast path; across Next's separate route bundles (the chat
      // route's runner vs this route) the singleton isn't guaranteed to be shared,
      // so the runner's emit may never reach this subscriber. Polling the DB (the
      // source of truth) is what reliably delivers the result. Runs immediately
      // (race-guard for an already-finished job) and then on an interval.
      const checkTerminal = async () => {
        if (settled) return;
        const job = await imageJobStore.get(jobId, userId);
        if (settled || !job) return;
        if (job.status === 'completed') {
          finish({
            type: IMAGE_EVENT_TYPES.COMPLETE,
            jobId,
            status: 'completed',
            url: job.resultUrl,
            storagePath: job.resultPath,
            source: job.source,
            attribution: job.attribution,
            prompt: job.prompt,
          });
        } else if (job.status === 'failed') {
          finish({
            type: IMAGE_EVENT_TYPES.FAILED,
            jobId,
            status: 'failed',
            error: job.error,
            prompt: job.prompt,
          });
        }
      };

      await checkTerminal();
      if (!settled) {
        pollHandle = setInterval(() => {
          void checkTerminal();
        }, IMAGE_STREAM_POLL_MS);
      }

      request.signal.addEventListener('abort', () => {
        imageSseService.off('image_event', handler);
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (pollHandle) clearInterval(pollHandle);
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
          if (pollHandle) clearInterval(pollHandle);
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
