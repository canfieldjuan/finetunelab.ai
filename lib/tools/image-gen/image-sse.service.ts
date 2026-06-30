/**
 * Process-local SSE event bus for async image jobs — the image analogue of
 * `lib/tools/web-search/sse.service.ts`. The background runner emits on the
 * `'image_event'` channel; the `/api/image/stream` route subscribes and relays
 * to the client. In-process only, which is fine: the runner and the stream
 * route run in the same Node server (`runtime = 'nodejs'`).
 */

import { EventEmitter } from 'events';

export const IMAGE_EVENT_TYPES = {
  CONNECTED: 'connected',
  COMPLETE: 'image_complete',
  FAILED: 'image_failed',
} as const;

/** A relayed image event always carries the jobId it belongs to. */
export interface ImageStreamEvent {
  type: string;
  jobId: string;
  [key: string]: unknown;
}

class ImageSseService extends EventEmitter {
  constructor() {
    super();
    // One listener per live stream connection (each off()s on finish/abort/timeout),
    // so listeners are bounded by concurrency. Raise the cap above Node's default 10
    // so many concurrent image streams don't trip a spurious max-listeners warning.
    this.setMaxListeners(1000);
  }

  /** Emit an event for a specific job (jobId is merged into the payload). */
  sendEvent(jobId: string, data: Record<string, unknown>): void {
    this.emit('image_event', { jobId, ...data });
  }
}

export const imageSseService = new ImageSseService();
