import { EventEmitter } from 'events';

class SseService extends EventEmitter {
  sendEvent(jobId: string, data: unknown) {
this.emit('research_event', { jobId, ...(data as object) });
  }
}

export const sseService = new SseService();
