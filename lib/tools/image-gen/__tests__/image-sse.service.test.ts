import { describe, it, expect, vi, afterEach } from 'vitest';
import { imageSseService, IMAGE_EVENT_TYPES } from '../image-sse.service';

describe('imageSseService', () => {
  afterEach(() => {
    imageSseService.removeAllListeners('image_event');
  });

  it('emits image_event with the jobId merged into the payload', () => {
    const handler = vi.fn();
    imageSseService.on('image_event', handler);
    imageSseService.sendEvent('job-1', { type: IMAGE_EVENT_TYPES.COMPLETE, url: 'https://x/y.png' });
    expect(handler).toHaveBeenCalledWith({
      jobId: 'job-1',
      type: 'image_complete',
      url: 'https://x/y.png',
    });
  });

  it('delivers to every subscriber (jobId in payload lets the route filter)', () => {
    const a = vi.fn();
    const b = vi.fn();
    imageSseService.on('image_event', a);
    imageSseService.on('image_event', b);
    imageSseService.sendEvent('jX', { type: IMAGE_EVENT_TYPES.FAILED, error: 'boom' });
    expect(a).toHaveBeenCalledWith({ jobId: 'jX', type: 'image_failed', error: 'boom' });
    expect(b).toHaveBeenCalledWith({ jobId: 'jX', type: 'image_failed', error: 'boom' });
  });
});
