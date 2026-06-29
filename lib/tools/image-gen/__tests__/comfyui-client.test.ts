import { describe, it, expect, vi } from 'vitest';
import { generateWithComfyUi } from '../comfyui-client';
import { ComfyUiError } from '../types';
import { buildFluxWorkflow } from '../flux-workflow';

const BASE = 'http://127.0.0.1:8188';
const PROMPT_ID = 'abc-123';
const wf = buildFluxWorkflow({ prompt: 'test' });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const historyDone = {
  [PROMPT_ID]: {
    outputs: { save: { images: [{ filename: 'out_0001.png', subfolder: '', type: 'output' }] } },
  },
};

describe('generateWithComfyUi', () => {
  it('queues, polls history, then downloads the image bytes', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/prompt')) return jsonResponse({ prompt_id: PROMPT_ID });
      if (url.includes('/history/')) return jsonResponse(historyDone);
      if (url.includes('/view')) return new Response(bytes, { status: 200 });
      throw new Error(`unexpected url ${url}`);
    });

    const result = await generateWithComfyUi(wf, { baseUrl: BASE, fetchImpl, pollIntervalMs: 0 });

    expect(result.filename).toBe('out_0001.png');
    expect(result.mimeType).toBe('image/png');
    expect(Array.from(result.imageBytes)).toEqual([0x89, 0x50, 0x4e, 0x47]);

    const viewCall = fetchImpl.mock.calls.find((c) => String(c[0]).includes('/view'));
    expect(viewCall).toBeDefined();
    const viewUrl = String(viewCall?.[0]);
    expect(viewUrl).toContain('filename=out_0001.png');
    expect(viewUrl).toContain('type=output');
  });

  it('keeps polling until the output node reports images', async () => {
    let historyCalls = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/prompt')) return jsonResponse({ prompt_id: PROMPT_ID });
      if (url.includes('/history/')) {
        historyCalls += 1;
        return historyCalls < 3 ? jsonResponse({}) : jsonResponse(historyDone);
      }
      return new Response(new Uint8Array([1]), { status: 200 });
    });

    const result = await generateWithComfyUi(wf, { baseUrl: BASE, fetchImpl, pollIntervalMs: 0 });
    expect(result.filename).toBe('out_0001.png');
    expect(historyCalls).toBeGreaterThanOrEqual(3);
  });

  it('passes an AbortSignal to every fetch', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/prompt')) return jsonResponse({ prompt_id: PROMPT_ID });
      if (url.includes('/history/')) return jsonResponse(historyDone);
      return new Response(new Uint8Array([1]), { status: 200 });
    });
    await generateWithComfyUi(wf, { baseUrl: BASE, fetchImpl, pollIntervalMs: 0 });
    for (const call of fetchImpl.mock.calls) {
      expect((call[1] as RequestInit | undefined)?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('throws ComfyUiError when /prompt is not ok', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({}, 500));
    await expect(
      generateWithComfyUi(wf, { baseUrl: BASE, fetchImpl, pollIntervalMs: 0 }),
    ).rejects.toBeInstanceOf(ComfyUiError);
  });

  it('throws when the prompt response has no prompt_id', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }));
    await expect(
      generateWithComfyUi(wf, { baseUrl: BASE, fetchImpl, pollIntervalMs: 0 }),
    ).rejects.toThrow(/missing prompt_id/);
  });

  it('times out when history never reports outputs', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/prompt')) return jsonResponse({ prompt_id: PROMPT_ID });
      return jsonResponse({}); // history forever empty
    });
    await expect(
      generateWithComfyUi(wf, { baseUrl: BASE, fetchImpl, pollIntervalMs: 0, timeoutMs: 10 }),
    ).rejects.toThrow(/timed out/i);
  });

  it('aborts a hung fetch so a stalled backend trips the deadline', async () => {
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
      if (String(input).endsWith('/prompt')) return Promise.resolve(jsonResponse({ prompt_id: PROMPT_ID }));
      // /history accepts the connection but never responds until aborted.
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener('abort', () =>
            reject(signal.reason ?? new DOMException('aborted', 'AbortError')),
          );
        }
      });
    });
    await expect(
      generateWithComfyUi(wf, { baseUrl: BASE, fetchImpl, pollIntervalMs: 0, timeoutMs: 25 }),
    ).rejects.toThrow(/timed out/i);
  });

  it('fails fast on a terminal ComfyUI execution error (no full-timeout wait)', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/prompt')) return jsonResponse({ prompt_id: PROMPT_ID });
      if (url.includes('/history/')) {
        return jsonResponse({ [PROMPT_ID]: { status: { status_str: 'error', completed: true }, outputs: {} } });
      }
      return new Response(new Uint8Array([1]), { status: 200 });
    });
    await expect(
      generateWithComfyUi(wf, { baseUrl: BASE, fetchImpl, pollIntervalMs: 0, timeoutMs: 5000 }),
    ).rejects.toThrow(/generation failed/i);
  });

  it('fails fast when ComfyUI completes with no output images', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/prompt')) return jsonResponse({ prompt_id: PROMPT_ID });
      if (url.includes('/history/')) {
        return jsonResponse({ [PROMPT_ID]: { status: { completed: true }, outputs: { save: { images: [] } } } });
      }
      return new Response(new Uint8Array([1]), { status: 200 });
    });
    await expect(
      generateWithComfyUi(wf, { baseUrl: BASE, fetchImpl, pollIntervalMs: 0, timeoutMs: 5000 }),
    ).rejects.toThrow(/no output images|generation failed/i);
  });

  it('fails fast after repeated non-ok /history responses', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (String(input).endsWith('/prompt')) return jsonResponse({ prompt_id: PROMPT_ID });
      return jsonResponse({ error: 'boom' }, 500); // history always 500
    });
    await expect(
      generateWithComfyUi(wf, { baseUrl: BASE, fetchImpl, pollIntervalMs: 0, timeoutMs: 5000 }),
    ).rejects.toThrow(/repeatedly returned 500/i);
  });

  it('wraps a network failure as ComfyUiError', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(
      generateWithComfyUi(wf, { baseUrl: BASE, fetchImpl, pollIntervalMs: 0 }),
    ).rejects.toBeInstanceOf(ComfyUiError);
  });
});
