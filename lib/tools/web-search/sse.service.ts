import { EventEmitter } from 'events';

class SseService extends EventEmitter {
  sendEvent(jobId: string, data: any) {
    this.emit('research_event', { jobId, ...data });
  }
}

export const sseService = new SseService();
