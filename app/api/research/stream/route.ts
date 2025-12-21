import { researchService } from '@/lib/tools/web-search/research.service';
import { sseService } from '@/lib/tools/web-search/sse.service';
import { NextRequest } from 'next/server';
import type {
  ResearchProgressEvent,
  ResearchOutlineEvent,
  ResearchSectionEvent,
  ResearchCitationEvent,
  ResearchCompleteEvent,
} from '@/lib/tools/web-search/types';
import { RESEARCH_EVENT_TYPES } from '@/lib/constants';

export const runtime = 'nodejs';

/**
 * SSE streaming endpoint for research progress events
 * Streams outline, section, citation, progress, and completion events
 */
type ResearchStreamEvent =
  | ResearchProgressEvent
  | ResearchOutlineEvent
  | ResearchSectionEvent
  | ResearchCitationEvent
  | ResearchCompleteEvent;

type ResearchEvent = ResearchStreamEvent & { jobId: string };

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return new Response(JSON.stringify({ error: 'jobId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Verify job exists
  const job = await researchService.getJob(jobId);
  if (!job) {
    return new Response(JSON.stringify({ error: 'Job not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  console.log(`[API /research/stream] Starting SSE stream for job: ${jobId}`);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Event handler for research events
      const eventHandler = (event: ResearchEvent) => {
        // Only stream events for this specific job
        if (event.jobId === jobId) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
          console.log(`[API /research/stream] Event sent: ${event.type}`);

          // Close stream on completion
          if (event.type === RESEARCH_EVENT_TYPES.RESEARCH_COMPLETE) {
            console.log(`[API /research/stream] Research complete, closing stream for job: ${jobId}`);
            controller.close();
            sseService.off('research_event', eventHandler);
          }
        }
      };

      // Subscribe to research events
      sseService.on('research_event', eventHandler);

      // Send initial connected event
      const connectedEvent = `data: ${JSON.stringify({
        type: RESEARCH_EVENT_TYPES.CONNECTED,
        jobId,
        message: 'SSE stream connected'
      })}\n\n`;
      controller.enqueue(encoder.encode(connectedEvent));

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        console.log(`[API /research/stream] Client disconnected for job: ${jobId}`);
        sseService.off('research_event', eventHandler);
        try {
          controller.close();
        } catch (_e) {
          // Ignore if already closed
        }
      });

      // Timeout after 10 minutes (research should complete before this)
      const _timeout = setTimeout(() => {
        console.log(`[API /research/stream] Timeout reached for job: ${jobId}`);
        sseService.off('research_event', eventHandler);
        try {
          controller.close();
        } catch (_e) {
          // Ignore if already closed
        }
      }, 10 * 60 * 1000);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
