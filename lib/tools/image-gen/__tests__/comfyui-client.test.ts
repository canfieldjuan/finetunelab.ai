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

    // /view called with the descriptor from history
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
    ).rejects.toThrow(/timed out/);
  });

  it('wraps a network failure as ComfyUiError', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(
      generateWithComfyUi(wf, { baseUrl: BASE, fetchImpl, pollIntervalMs: 0 }),
    ).rejects.toThrow(/unreachable/);
  });
});
