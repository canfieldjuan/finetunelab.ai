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

class MockEventSource {
  static instances: MockEventSource[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
  }

  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }
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

function renderAuthenticatedUseChat() {
  return renderHook(() => useChat({
    user: { id: 'user-1' } as never,
    activeId: '22222222-2222-4222-8222-222222222222',
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
    allowAnonymous: false,
  }));
}

interface MockAttachmentRow {
  id: string;
  conversation_id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number;
  kind: string;
  extracted_chars: number;
  status: string;
}

function createAttachmentSelect(rows: MockAttachmentRow[] | Promise<MockAttachmentRow[]> = []) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: await rows, error: null })),
  };
  return query;
}

function mockSupabaseTables(options?: {
  attachmentRows?: MockAttachmentRow[] | Promise<MockAttachmentRow[]>;
  persistAssistant?: boolean;
}) {
  const attachmentSelect = createAttachmentSelect(options?.attachmentRows ?? []);
  let persistedAssistantCount = 0;
  const messageInsert = vi.fn((payload: { role?: string; content?: string; metadata?: unknown }) => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => {
        if (options?.persistAssistant && payload.role === 'assistant') {
          persistedAssistantCount += 1;
          return {
            data: {
              id: `assistant-db-${persistedAssistantCount}`,
              role: 'assistant',
              content: payload.content,
              metadata: payload.metadata,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      }),
    })),
  }));

  from.mockImplementation((table: string) => {
    if (table === 'chat_attachments') return attachmentSelect;
    return {
      insert: messageInsert,
    };
  });

  return { attachmentSelect, messageInsert };
}

function mockMessageInsert(options?: { persistAssistant?: boolean }) {
  return mockSupabaseTables(options);
}

function restoredAttachmentRow(overrides?: Partial<MockAttachmentRow>): MockAttachmentRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    conversation_id: '22222222-2222-4222-8222-222222222222',
    filename: 'notes.txt',
    content_type: 'text/plain',
    size_bytes: 11,
    kind: 'text',
    extracted_chars: 11,
    status: 'uploaded',
    ...overrides,
  };
}

describe('useChat MCP SSE metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    mockSupabaseTables();
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

  it('persists completed generated image results as assistant messages', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } } });
    const { messageInsert } = mockSupabaseTables({ persistAssistant: true });
    vi.stubGlobal('EventSource', MockEventSource);
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (input === '/api/chat') {
        return streamResponse([
          'data: {"type":"image_generation_started","jobId":"img-job-1","prompt":"a flux test","streamToken":"signed-token"}\n\n',
          'data: {"content":"I started the image."}\n\n',
          'data: [DONE]\n\n',
        ]);
      }

      throw new Error(`Unexpected fetch ${String(input)}`);
    });

    const { result } = renderAuthenticatedUseChat();

    await act(async () => {
      await result.current.handleSendMessage('Make an image.');
    });

    expect(result.current.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'assistant',
        content: 'I started the image.',
      }),
    ]));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });
    expect(MockEventSource.instances[0].url).toBe('/api/image/stream?jobId=img-job-1&token=signed-token');

    await act(async () => {
      MockEventSource.instances[0].emit({
        type: 'image_complete',
        jobId: 'img-job-1',
        url: 'https://images.example/generated.png',
        source: 'comfyui',
        prompt: 'a flux test',
      });
      await Promise.resolve();
    });

    const imageInsert = messageInsert.mock.calls.find(([payload]) => (
      payload.role === 'assistant' &&
      payload.content === '![a flux test](https://images.example/generated.png)'
    ));
    expect(imageInsert?.[0]).toMatchObject({
      conversation_id: '22222222-2222-4222-8222-222222222222',
      user_id: 'user-1',
      role: 'assistant',
      content: '![a flux test](https://images.example/generated.png)',
    });
    expect(result.current.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'assistant-db-2',
        role: 'assistant',
        content: '![a flux test](https://images.example/generated.png)',
        skipJudgments: true,
      }),
    ]));
  });

  it('uploads attachments first and sends only attachment ids with the chat turn', async () => {
    const chatRequests: unknown[] = [];
    getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } } });
    mockMessageInsert({ persistAssistant: true });
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (input === '/api/chat/attachments') {
        expect(init?.headers).toEqual(expect.objectContaining({
          Authorization: 'Bearer session-token',
        }));
        expect(init?.body).toBeInstanceOf(FormData);
        return new Response(JSON.stringify({
          success: true,
          attachment: {
            id: '11111111-1111-4111-8111-111111111111',
            filename: 'notes.txt',
            contentType: 'text/plain',
            sizeBytes: 11,
            kind: 'text',
            extractedChars: 11,
            status: 'uploaded',
          },
        }), { status: 201, headers: { 'content-type': 'application/json' } });
      }

      if (input === '/api/chat') {
        chatRequests.push(JSON.parse(String(init?.body)));
        return streamResponse([
          'data: {"type":"attachment_metadata","attachment_ids":["11111111-1111-4111-8111-111111111111"],"attachments":[{"id":"11111111-1111-4111-8111-111111111111","filename":"notes.txt","contentType":"text/plain","sizeBytes":11,"kind":"text","extractedChars":11,"status":"attached"}]}\n\n',
          'data: {"content":"Read the attachment."}\n\n',
          'data: [DONE]\n\n',
        ]);
      }

      throw new Error(`Unexpected fetch ${String(input)}`);
    });

    const { result } = renderAuthenticatedUseChat();
    const file = new File(['hello world'], 'notes.txt', { type: 'text/plain' });

    act(() => {
      result.current.handleAddChatAttachments([file]);
    });

    await waitFor(() => {
      expect(result.current.pendingAttachments[0]).toMatchObject({
        status: 'uploaded',
        attachment: {
          id: '11111111-1111-4111-8111-111111111111',
          filename: 'notes.txt',
        },
      });
    });

    await act(async () => {
      await result.current.handleSendMessage('Summarize this file.');
    });

    expect(chatRequests).toHaveLength(1);
    expect(chatRequests[0]).toMatchObject({
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
      messages: expect.arrayContaining([
        { role: 'user', content: 'Summarize this file.' },
      ]),
    });
    expect(chatRequests[0]).not.toMatchObject({
      file,
    });
    expect(result.current.pendingAttachments).toEqual([]);
    expect(result.current.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'user',
        attachments: [expect.objectContaining({ filename: 'notes.txt' })],
      }),
      expect.objectContaining({
        role: 'assistant',
        id: 'assistant-db-1',
        attachments: [expect.objectContaining({ filename: 'notes.txt', status: 'attached' })],
      }),
    ]));
  });

  it('can replay a historical prompt without consuming uploaded composer drafts', async () => {
    const chatRequests: unknown[] = [];
    getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } } });
    mockMessageInsert();
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (input === '/api/chat/attachments') {
        return new Response(JSON.stringify({
          success: true,
          attachment: {
            id: '11111111-1111-4111-8111-111111111111',
            filename: 'draft.txt',
            contentType: 'text/plain',
            sizeBytes: 11,
            kind: 'text',
            extractedChars: 11,
            status: 'uploaded',
          },
        }), { status: 201, headers: { 'content-type': 'application/json' } });
      }

      if (input === '/api/chat') {
        chatRequests.push(JSON.parse(String(init?.body)));
        return streamResponse([
          'data: {"content":"Regenerated."}\n\n',
          'data: [DONE]\n\n',
        ]);
      }

      throw new Error(`Unexpected fetch ${String(input)}`);
    });

    const { result } = renderAuthenticatedUseChat();

    act(() => {
      result.current.handleAddChatAttachments([
        new File(['hello world'], 'draft.txt', { type: 'text/plain' }),
      ]);
    });

    await waitFor(() => {
      expect(result.current.pendingAttachments[0]).toMatchObject({
        status: 'uploaded',
        attachment: { id: '11111111-1111-4111-8111-111111111111' },
      });
    });

    await act(async () => {
      await result.current.handleSendMessage('Replay old prompt.', { includePendingAttachments: false });
    });

    expect(chatRequests).toHaveLength(1);
    expect(chatRequests[0]).not.toHaveProperty('attachmentIds');
    expect(result.current.pendingAttachments).toEqual([
      expect.objectContaining({
        status: 'uploaded',
        attachment: expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }),
      }),
    ]);
  });

  it('can replay a historical prompt with its original attachment ids while preserving composer drafts', async () => {
    const chatRequests: unknown[] = [];
    getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } } });
    mockMessageInsert();
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (input === '/api/chat/attachments') {
        return new Response(JSON.stringify({
          success: true,
          attachment: {
            id: '11111111-1111-4111-8111-111111111111',
            filename: 'draft.txt',
            contentType: 'text/plain',
            sizeBytes: 11,
            kind: 'text',
            extractedChars: 11,
            status: 'uploaded',
          },
        }), { status: 201, headers: { 'content-type': 'application/json' } });
      }

      if (input === '/api/chat') {
        chatRequests.push(JSON.parse(String(init?.body)));
        return streamResponse([
          'data: {"content":"Regenerated with file context."}\n\n',
          'data: [DONE]\n\n',
        ]);
      }

      throw new Error(`Unexpected fetch ${String(input)}`);
    });

    const { result } = renderAuthenticatedUseChat();

    act(() => {
      result.current.handleAddChatAttachments([
        new File(['new draft'], 'draft.txt', { type: 'text/plain' }),
      ]);
    });

    await waitFor(() => {
      expect(result.current.pendingAttachments[0]).toMatchObject({
        status: 'uploaded',
        attachment: { id: '11111111-1111-4111-8111-111111111111' },
      });
    });

    await act(async () => {
      await result.current.handleSendMessage('Replay old prompt.', {
        includePendingAttachments: false,
        attachmentIds: ['22222222-2222-4222-8222-222222222222'],
        attachments: [{
          id: '22222222-2222-4222-8222-222222222222',
          filename: 'original.md',
          contentType: 'text/markdown',
          sizeBytes: 13,
          kind: 'text',
          extractedChars: 13,
          status: 'attached',
        }],
      });
    });

    expect(chatRequests).toHaveLength(1);
    expect(chatRequests[0]).toMatchObject({
      replayAttachmentIds: ['22222222-2222-4222-8222-222222222222'],
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: 'Replay old prompt.',
        }),
      ]),
    });
    expect(result.current.pendingAttachments).toEqual([
      expect.objectContaining({
        status: 'uploaded',
        attachment: expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }),
      }),
    ]);
    expect(result.current.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'user',
        attachment_ids: ['22222222-2222-4222-8222-222222222222'],
        attachments: [expect.objectContaining({ filename: 'original.md' })],
      }),
    ]));
  });

  it('does not restore a duplicate uploaded draft while a local upload is still in flight', async () => {
    let resolveRestore: (rows: MockAttachmentRow[]) => void = () => {};
    let resolveUpload: (response: Response) => void = () => {};
    const restoreRows = new Promise<MockAttachmentRow[]>((resolve) => {
      resolveRestore = resolve;
    });
    const uploadResponse = new Promise<Response>((resolve) => {
      resolveUpload = resolve;
    });
    getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } } });
    mockSupabaseTables({ attachmentRows: restoreRows });
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (input === '/api/chat/attachments') {
        return uploadResponse;
      }

      throw new Error(`Unexpected fetch ${String(input)}`);
    });

    const { result } = renderAuthenticatedUseChat();

    act(() => {
      result.current.handleAddChatAttachments([
        new File(['hello world'], 'notes.txt', { type: 'text/plain' }),
      ]);
    });

    await waitFor(() => {
      expect(result.current.pendingAttachments).toEqual([
        expect.objectContaining({ status: 'uploading' }),
      ]);
    });

    await act(async () => {
      resolveRestore([restoredAttachmentRow()]);
      await Promise.resolve();
    });

    expect(result.current.pendingAttachments).toHaveLength(1);
    expect(result.current.pendingAttachments[0]).toMatchObject({
      status: 'uploading',
    });

    await act(async () => {
      resolveUpload(new Response(JSON.stringify({
        success: true,
        attachment: {
          id: '11111111-1111-4111-8111-111111111111',
          filename: 'notes.txt',
          contentType: 'text/plain',
          sizeBytes: 11,
          kind: 'text',
          extractedChars: 11,
          status: 'uploaded',
        },
      }), { status: 201, headers: { 'content-type': 'application/json' } }));
    });

    await waitFor(() => {
      expect(result.current.pendingAttachments).toEqual([
        expect.objectContaining({
          status: 'uploaded',
          attachment: expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }),
        }),
      ]);
    });
  });

  it.each([
    {
      label: 'uploading',
      uploadResponse: () => new Promise<Response>(() => {}),
      expectedStatus: 'uploading',
    },
    {
      label: 'failed',
      uploadResponse: () => Promise.resolve(new Response(JSON.stringify({
        success: false,
        error: 'upload failed',
      }), { status: 500, headers: { 'content-type': 'application/json' } })),
      expectedStatus: 'error',
    },
  ])('can replay a historical prompt while an unrelated composer draft is $label', async ({ uploadResponse, expectedStatus }) => {
    const chatRequests: unknown[] = [];
    getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } } });
    mockMessageInsert();
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (input === '/api/chat/attachments') {
        return uploadResponse();
      }

      if (input === '/api/chat') {
        chatRequests.push(JSON.parse(String(init?.body)));
        return streamResponse([
          'data: {"content":"Regenerated."}\n\n',
          'data: [DONE]\n\n',
        ]);
      }

      throw new Error(`Unexpected fetch ${String(input)}`);
    });

    const { result } = renderAuthenticatedUseChat();

    act(() => {
      result.current.handleAddChatAttachments([
        new File(['hello world'], 'draft.txt', { type: 'text/plain' }),
      ]);
    });

    await waitFor(() => {
      expect(result.current.pendingAttachments[0]).toMatchObject({
        status: expectedStatus,
      });
    });

    await act(async () => {
      await result.current.handleSendMessage('Replay old prompt.', { includePendingAttachments: false });
    });

    expect(chatRequests).toHaveLength(1);
    expect(chatRequests[0]).not.toHaveProperty('attachmentIds');
    expect(result.current.error).toBeNull();
    expect(result.current.pendingAttachments[0]).toMatchObject({
      status: expectedStatus,
    });
  });

  it('keeps uploaded attachment drafts pending when the SSE stream reports an error', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } } });
    mockMessageInsert();
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (input === '/api/chat/attachments') {
        return new Response(JSON.stringify({
          success: true,
          attachment: {
            id: '11111111-1111-4111-8111-111111111111',
            filename: 'notes.txt',
            contentType: 'text/plain',
            sizeBytes: 11,
            kind: 'text',
            extractedChars: 11,
            status: 'uploaded',
          },
        }), { status: 201, headers: { 'content-type': 'application/json' } });
      }

      if (input === '/api/chat') {
        return streamResponse([
          'data: {"error":"Stream error"}\n\n',
        ]);
      }

      throw new Error(`Unexpected fetch ${String(input)}`);
    });

    const { result } = renderAuthenticatedUseChat();

    act(() => {
      result.current.handleAddChatAttachments([
        new File(['hello world'], 'notes.txt', { type: 'text/plain' }),
      ]);
    });

    await waitFor(() => {
      expect(result.current.pendingAttachments[0]).toMatchObject({
        status: 'uploaded',
        attachment: { id: '11111111-1111-4111-8111-111111111111' },
      });
    });

    await act(async () => {
      await result.current.handleSendMessage('Summarize this file.');
    });

    expect(result.current.error).toBe('Stream error');
    expect(result.current.pendingAttachments).toEqual([
      expect.objectContaining({
        status: 'uploaded',
        attachment: expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }),
      }),
    ]);
  });

  it('retries deleting an uploaded attachment after a transient delete failure', async () => {
    let deleteAttempts = 0;
    getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } } });
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (input === '/api/chat/attachments' && init?.method === 'POST') {
        return new Response(JSON.stringify({
          success: true,
          attachment: {
            id: '11111111-1111-4111-8111-111111111111',
            filename: 'notes.txt',
            contentType: 'text/plain',
            sizeBytes: 11,
            kind: 'text',
            extractedChars: 11,
            status: 'uploaded',
          },
        }), { status: 201, headers: { 'content-type': 'application/json' } });
      }

      if (input === '/api/chat/attachments' && init?.method === 'DELETE') {
        deleteAttempts += 1;
        if (deleteAttempts === 1) {
          return new Response(JSON.stringify({ success: false, error: 'temporary delete failure' }), {
            status: 503,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true, deletedIds: ['11111111-1111-4111-8111-111111111111'] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch ${String(input)}`);
    });

    const { result } = renderAuthenticatedUseChat();

    act(() => {
      result.current.handleAddChatAttachments([
        new File(['hello world'], 'notes.txt', { type: 'text/plain' }),
      ]);
    });

    await waitFor(() => {
      expect(result.current.pendingAttachments[0]).toMatchObject({
        status: 'uploaded',
        attachment: { id: '11111111-1111-4111-8111-111111111111' },
      });
    });

    const clientId = result.current.pendingAttachments[0].clientId;

    await act(async () => {
      await result.current.handleRemoveChatAttachment(clientId);
    });

    expect(result.current.pendingAttachments[0]).toMatchObject({
      status: 'error',
      attachment: { id: '11111111-1111-4111-8111-111111111111' },
    });

    await act(async () => {
      await result.current.handleRemoveChatAttachment(clientId);
    });

    expect(deleteAttempts).toBe(2);
    expect(result.current.pendingAttachments).toEqual([]);
  });

  it('restores uploaded attachment drafts from Supabase and keeps the delete path available', async () => {
    let deletedBody: { conversationId?: string; attachmentIds?: string[] } | null = null;
    getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } } });
    const { attachmentSelect } = mockSupabaseTables({
      attachmentRows: [restoredAttachmentRow()],
    });
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (input === '/api/chat/attachments' && init?.method === 'DELETE') {
        deletedBody = JSON.parse(String(init.body));
        return new Response(JSON.stringify({
          success: true,
          deletedIds: ['11111111-1111-4111-8111-111111111111'],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }

      throw new Error(`Unexpected fetch ${String(input)}`);
    });

    const { result } = renderAuthenticatedUseChat();

    await waitFor(() => {
      expect(result.current.pendingAttachments).toEqual([
        expect.objectContaining({
          clientId: 'restored-11111111-1111-4111-8111-111111111111',
          status: 'uploaded',
          attachment: expect.objectContaining({
            id: '11111111-1111-4111-8111-111111111111',
            filename: 'notes.txt',
          }),
        }),
      ]);
    });

    expect(attachmentSelect.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(attachmentSelect.eq).toHaveBeenCalledWith(
      'conversation_id',
      '22222222-2222-4222-8222-222222222222',
    );
    expect(attachmentSelect.eq).toHaveBeenCalledWith('status', 'uploaded');

    await act(async () => {
      await result.current.handleRemoveChatAttachment(result.current.pendingAttachments[0].clientId);
    });

    expect(deletedBody).toEqual({
      conversationId: '22222222-2222-4222-8222-222222222222',
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
    });
    expect(result.current.pendingAttachments).toEqual([]);
  });

  it('does not delete an uploaded attachment while its chat turn is in flight', async () => {
    let deleteAttempts = 0;
    let resolveChatResponse: (response: Response) => void = () => {};
    const chatResponse = new Promise<Response>((resolve) => {
      resolveChatResponse = resolve;
    });
    getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } } });
    mockMessageInsert();
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (input === '/api/chat/attachments' && init?.method === 'POST') {
        return new Response(JSON.stringify({
          success: true,
          attachment: {
            id: '11111111-1111-4111-8111-111111111111',
            filename: 'notes.txt',
            contentType: 'text/plain',
            sizeBytes: 11,
            kind: 'text',
            extractedChars: 11,
            status: 'uploaded',
          },
        }), { status: 201, headers: { 'content-type': 'application/json' } });
      }

      if (input === '/api/chat/attachments' && init?.method === 'DELETE') {
        deleteAttempts += 1;
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (input === '/api/chat') {
        return chatResponse;
      }

      throw new Error(`Unexpected fetch ${String(input)}`);
    });

    const { result } = renderAuthenticatedUseChat();

    act(() => {
      result.current.handleAddChatAttachments([
        new File(['hello world'], 'notes.txt', { type: 'text/plain' }),
      ]);
    });

    await waitFor(() => {
      expect(result.current.pendingAttachments[0]).toMatchObject({
        status: 'uploaded',
        attachment: { id: '11111111-1111-4111-8111-111111111111' },
      });
    });

    const clientId = result.current.pendingAttachments[0].clientId;
    let sendPromise: Promise<void>;
    act(() => {
      sendPromise = result.current.handleSendMessage('Summarize this file.');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      await result.current.handleRemoveChatAttachment(clientId);
    });

    expect(deleteAttempts).toBe(0);
    expect(result.current.pendingAttachments[0]).toMatchObject({
      status: 'uploaded',
      attachment: { id: '11111111-1111-4111-8111-111111111111' },
    });

    await act(async () => {
      resolveChatResponse(streamResponse([
        'data: {"content":"Read the attachment."}\n\n',
        'data: [DONE]\n\n',
      ]));
      await sendPromise!;
    });

    expect(result.current.pendingAttachments).toEqual([]);
  });
});
