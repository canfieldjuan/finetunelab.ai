import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const createClient = vi.hoisted(() => vi.fn());
const parseAttachment = vi.hoisted(() => vi.fn());
const validateFileType = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient,
}));

vi.mock('@/lib/graphrag/parsers', () => ({
  parserFactory: {
    parse: parseAttachment,
    validateFileType,
  },
}));

function makeRequest(formData: FormData, headers?: Record<string, string>): NextRequest {
  return {
    headers: new Headers(headers ?? {}),
    formData: async () => formData,
  } as unknown as NextRequest;
}

function makeUploadSupabase(options?: {
  userId?: string | null;
  conversation?: { id: string } | null;
  pendingAttachments?: Array<{ id: string }>;
  insertError?: { message: string } | null;
}) {
  const userId = options?.userId ?? 'user-1';
  const upload = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async () => ({ error: null }));

  const conversationsQuery = {
    select: vi.fn(() => conversationsQuery),
    eq: vi.fn(() => conversationsQuery),
    maybeSingle: vi.fn(async () => ({
      data: options?.conversation === undefined ? { id: 'conv-1' } : options.conversation,
      error: null,
    })),
  };

  const pendingQuery = {
    data: options?.pendingAttachments ?? [],
    error: null,
    select: vi.fn(() => pendingQuery),
    eq: vi.fn(() => pendingQuery),
  };

  const insertQuery = {
    select: vi.fn(() => insertQuery),
    single: vi.fn(async () => ({
      data: {
        id: 'attachment-1',
        filename: 'notes.txt',
        content_type: 'text/plain',
        size_bytes: 11,
        kind: 'text',
        extracted_chars: 11,
        status: 'uploaded',
      },
      error: options?.insertError ?? null,
    })),
  };

  const chatAttachmentsTable = {
    select: vi.fn(() => pendingQuery),
    insert: vi.fn(() => insertQuery),
  };

  const from = vi.fn((table: string) => {
    if (table === 'conversations') return conversationsQuery;
    if (table === 'chat_attachments') return chatAttachmentsTable;
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: userId ? { id: userId } : null },
          error: userId ? null : { message: 'invalid' },
        })),
      },
      from,
      storage: {
        from: vi.fn(() => ({ upload, remove })),
      },
    },
    from,
    upload,
    remove,
    chatAttachmentsTable,
    conversationsQuery,
  };
}

function makeAttachmentForm(file = new File(['hello world'], 'notes.txt', { type: 'text/plain' })) {
  const formData = new FormData();
  formData.set('file', file);
  formData.set('conversationId', 'conv-1');
  return formData;
}

describe('POST /api/chat/attachments', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    parseAttachment.mockResolvedValue({
      text: 'hello world',
      metadata: { encoding: 'utf8' },
      fileType: 'txt',
    });
    validateFileType.mockReturnValue(true);
  });

  it('rejects missing bearer auth', async () => {
    const { POST } = await import('../route');
    const response = await POST(makeRequest(makeAttachmentForm()));

    expect(response.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('rejects a conversation not owned by the authenticated user', async () => {
    const supabase = makeUploadSupabase({ conversation: null });
    createClient.mockReturnValue(supabase.client);

    const { POST } = await import('../route');
    const response = await POST(makeRequest(makeAttachmentForm(), {
      authorization: 'Bearer session-token',
    }));

    expect(response.status).toBe(404);
    expect(supabase.upload).not.toHaveBeenCalled();
  });

  it('rejects unsupported attachment types before upload', async () => {
    const supabase = makeUploadSupabase();
    createClient.mockReturnValue(supabase.client);

    const { POST } = await import('../route');
    const response = await POST(makeRequest(makeAttachmentForm(
      new File(['not an image path'], 'image.png', { type: 'image/png' }),
    ), {
      authorization: 'Bearer session-token',
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Unsupported attachment file type',
    });
    expect(supabase.upload).not.toHaveBeenCalled();
  });

  it('rejects oversized attachments before extraction or upload', async () => {
    const supabase = makeUploadSupabase();
    createClient.mockReturnValue(supabase.client);

    const { POST } = await import('../route');
    const response = await POST(makeRequest(makeAttachmentForm(
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.txt', { type: 'text/plain' }),
    ), {
      authorization: 'Bearer session-token',
    }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Attachment file exceeds the 10 MB limit',
    });
    expect(parseAttachment).not.toHaveBeenCalled();
    expect(supabase.upload).not.toHaveBeenCalled();
  });

  it('uploads, extracts, and returns a compact attachment DTO', async () => {
    const supabase = makeUploadSupabase();
    createClient.mockReturnValue(supabase.client);

    const { POST } = await import('../route');
    const response = await POST(makeRequest(makeAttachmentForm(), {
      authorization: 'Bearer session-token',
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      attachment: {
        id: 'attachment-1',
        filename: 'notes.txt',
        contentType: 'text/plain',
        sizeBytes: 11,
        kind: 'text',
        extractedChars: 11,
        status: 'uploaded',
      },
    });
    expect(parseAttachment).toHaveBeenCalledWith(expect.any(Buffer), 'txt');
    expect(supabase.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/conv-1\/[0-9a-f-]+\/notes\.txt$/),
      expect.any(File),
      expect.objectContaining({ contentType: 'text/plain', upsert: false }),
    );
    expect(supabase.chatAttachmentsTable.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      conversation_id: 'conv-1',
      filename: 'notes.txt',
      extracted_text: 'hello world',
      extracted_chars: 11,
      status: 'uploaded',
    }));
  });
});
