import { researchService } from '@/lib/tools/web-search/research.service';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

/**
 * SSE streaming endpoint for research progress events
 * Streams outline, section, citation, progress, and completion events
 */
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
  const job = researchService.getJob(jobId);
  if (!job) {
    return new Response(JSON.stringify({ error: 'Job not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  console.log(`[API /research/stream] Starting SSE stream for job: ${jobId}`);

  const encoder = new TextEncoder();
  // TODO: Implement getEventEmitter method in ResearchService
  const eventEmitter = (researchService as any).getEventEmitter?.() || { on: () => {}, off: () => {} };

  const stream = new ReadableStream({
    start(controller) {
      // Event handler for research events
      const eventHandler = (event: any) => {
        // Only stream events for this specific job
        if (event.jobId === jobId) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
          console.log(`[API /research/stream] Event sent: ${event.type}`);

          // Close stream on completion
          if (event.type === 'research_complete') {
            console.log(`[API /research/stream] Research complete, closing stream for job: ${jobId}`);
            controller.close();
            eventEmitter.off('research_event', eventHandler);
          }
        }
      };

      // Subscribe to research events
      eventEmitter.on('research_event', eventHandler);

      // Send initial connected event
      const connectedEvent = `data: ${JSON.stringify({
        type: 'connected',
        jobId,
        message: 'SSE stream connected'
      })}\n\n`;
      controller.enqueue(encoder.encode(connectedEvent));

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        console.log(`[API /research/stream] Client disconnected for job: ${jobId}`);
        eventEmitter.off('research_event', eventHandler);
        controller.close();
      });

      // Timeout after 10 minutes (research should complete before this)
      const timeout = setTimeout(() => {
        console.log(`[API /research/stream] Timeout reached for job: ${jobId}`);
        eventEmitter.off('research_event', eventHandler);
        controller.close();
      }, 10 * 60 * 1000);

      // Clear timeout if stream ends naturally
      controller.close = ((originalClose) => {
        return () => {
          clearTimeout(timeout);
          originalClose.call(controller);
        };
      })(controller.close);
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
