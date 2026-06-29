// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChat } from '../useChat';

const getSession = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession,
    },
    from,
  },
}));

vi.mock('@/lib/utils/logger', () => ({
  log: {
    debug: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  }), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function renderUseChat() {
  return renderHook(() => useChat({
    user: null,
    activeId: '',
    tools: [],
    enableDeepResearch: false,
    selectedModelId: 'model-vllm-qwen',
    contextTrackerRef: { current: null },
    setContextUsage: vi.fn(),
    isStreamingRef: { current: false },
    researchProgress: null,
    setResearchProgress: vi.fn(),
    activeResearchJob: null,
    setActiveResearchJob: vi.fn(),
    contextInjectionEnabled: false,
    allowAnonymous: true,
  }));
}

describe('useChat MCP SSE metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse([
      'data: {"type":"tools_metadata","tools_called":[{"name":"mcp__docs__lookup","success":true}]}\n\n',
      'data: {"content":"Found via live MCP."}\n\n',
      'data: [DONE]\n\n',
    ])));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores streamed MCP tool metadata on the assistant message', async () => {
    const { result } = renderUseChat();

    await act(async () => {
      await result.current.handleSendMessage('Use the docs MCP server.');
    });

    await waitFor(() => {
      expect(result.current.messages.some((message) => (
        message.role === 'assistant' && message.content === 'Found via live MCP.'
      ))).toBe(true);
    });

    const assistant = result.current.messages.find((message) => message.role === 'assistant');

    expect(assistant).toEqual(expect.objectContaining({
      content: 'Found via live MCP.',
      tools_called: [{ name: 'mcp__docs__lookup', success: true }],
    }));
    expect(getSession).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
      }),
    }));
  });
});
