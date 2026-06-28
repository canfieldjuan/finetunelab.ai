import { afterEach, describe, expect, it, vi } from 'vitest';

describe('/api/models/test-connection contract', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses served_model_name for vLLM OpenAI-compatible probes', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', upstreamFetch);

    const { POST } = await import('../test-connection/route');

    const response = await POST(new Request('http://localhost/api/models/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'vllm',
        base_url: 'http://localhost:8000/v1',
        model_id: '/models/qwen',
        served_model_name: 'qwen-chat',
        auth_type: 'none',
        api_key: 'unused-test-key',
      }),
    }) as never);

    expect(response.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    const [url, init] = upstreamFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    expect(url).toBe('http://localhost:8000/v1/chat/completions');
    expect(body).toEqual(expect.objectContaining({
      model: 'qwen-chat',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 5,
    }));
  });

  it('uses served_model_name and native /api/generate for Ollama probes', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', upstreamFetch);

    const { POST } = await import('../test-connection/route');

    const response = await POST(new Request('http://localhost/api/models/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'ollama',
        base_url: 'http://localhost:11434/v1',
        model_id: '/models/llama3.2',
        served_model_name: 'llama3.2',
        auth_type: 'none',
      }),
    }) as never);

    expect(response.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    const [url, init] = upstreamFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    expect(url).toBe('http://localhost:11434/api/generate');
    expect(body).toEqual(expect.objectContaining({
      model: 'llama3.2',
      prompt: 'test',
      stream: false,
    }));
  });
});
