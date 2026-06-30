import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import * as yazl from 'yazl';

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

function makeRequest(
  formData: FormData,
  headers?: Record<string, string>,
  options?: { omitDefaultContentLength?: boolean },
): NextRequest {
  const requestHeaders = new Headers(headers ?? {});
  if (
    !options?.omitDefaultContentLength &&
    requestHeaders.has('authorization') &&
    !requestHeaders.has('content-length')
  ) {
    requestHeaders.set('content-length', '1024');
  }
  return {
    headers: requestHeaders,
    formData: vi.fn(async () => formData),
  } as unknown as NextRequest;
}

function makeJsonRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  return {
    headers: new Headers(headers ?? {}),
    json: vi.fn(async () => body),
  } as unknown as NextRequest;
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

function makeZipWithEntryUncompressedSize(uncompressedSize: number): ArrayBuffer {
  const filename = Buffer.from('[Content_Types].xml');
  const localHeader = Buffer.alloc(30 + filename.length);
  let offset = 0;
  localHeader.writeUInt32LE(0x04034b50, offset); offset += 4;
  localHeader.writeUInt16LE(20, offset); offset += 2;
  localHeader.writeUInt16LE(0, offset); offset += 2;
  localHeader.writeUInt16LE(8, offset); offset += 2;
  localHeader.writeUInt16LE(0, offset); offset += 2;
  localHeader.writeUInt16LE(0, offset); offset += 2;
  localHeader.writeUInt32LE(0, offset); offset += 4;
  localHeader.writeUInt32LE(0, offset); offset += 4;
  localHeader.writeUInt32LE(uncompressedSize, offset); offset += 4;
  localHeader.writeUInt16LE(filename.length, offset); offset += 2;
  localHeader.writeUInt16LE(0, offset); offset += 2;
  filename.copy(localHeader, offset);

  const centralDirectoryOffset = localHeader.length;
  const centralDirectory = Buffer.alloc(46 + filename.length);
  offset = 0;
  centralDirectory.writeUInt32LE(0x02014b50, offset); offset += 4;
  centralDirectory.writeUInt16LE(20, offset); offset += 2;
  centralDirectory.writeUInt16LE(20, offset); offset += 2;
  centralDirectory.writeUInt16LE(0, offset); offset += 2;
  centralDirectory.writeUInt16LE(8, offset); offset += 2;
  centralDirectory.writeUInt16LE(0, offset); offset += 2;
  centralDirectory.writeUInt16LE(0, offset); offset += 2;
  centralDirectory.writeUInt32LE(0, offset); offset += 4;
  centralDirectory.writeUInt32LE(0, offset); offset += 4;
  centralDirectory.writeUInt32LE(uncompressedSize, offset); offset += 4;
  centralDirectory.writeUInt16LE(filename.length, offset); offset += 2;
  centralDirectory.writeUInt16LE(0, offset); offset += 2;
  centralDirectory.writeUInt16LE(0, offset); offset += 2;
  centralDirectory.writeUInt16LE(0, offset); offset += 2;
  centralDirectory.writeUInt16LE(0, offset); offset += 2;
  centralDirectory.writeUInt32LE(0, offset); offset += 4;
  centralDirectory.writeUInt32LE(0, offset); offset += 4;
  filename.copy(centralDirectory, offset);

  const endOfCentralDirectory = Buffer.alloc(22);
  offset = 0;
  endOfCentralDirectory.writeUInt32LE(0x06054b50, offset); offset += 4;
  endOfCentralDirectory.writeUInt16LE(0, offset); offset += 2;
  endOfCentralDirectory.writeUInt16LE(0, offset); offset += 2;
  endOfCentralDirectory.writeUInt16LE(1, offset); offset += 2;
  endOfCentralDirectory.writeUInt16LE(1, offset); offset += 2;
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, offset); offset += 4;
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, offset); offset += 4;
  endOfCentralDirectory.writeUInt16LE(0, offset);

  return toArrayBuffer(Buffer.concat([localHeader, centralDirectory, endOfCentralDirectory]));
}

async function makeZipWithEntryContent(content: Buffer): Promise<ArrayBuffer> {
  const zipfile = new yazl.ZipFile();
  const chunks: Buffer[] = [];

  const output = new Promise<ArrayBuffer>((resolve, reject) => {
    zipfile.outputStream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    zipfile.outputStream.on('error', reject);
    zipfile.outputStream.on('end', () => resolve(toArrayBuffer(Buffer.concat(chunks))));
  });

  zipfile.addBuffer(content, 'word/document.xml');
  zipfile.end();

  return output;
}

function rewriteZipUncompressedSizes(zip: ArrayBuffer, uncompressedSize: number): ArrayBuffer {
  const buffer = Buffer.from(zip);
  const localHeaderSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const centralDirectorySignature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);

  let offset = buffer.indexOf(localHeaderSignature);
  while (offset !== -1) {
    buffer.writeUInt32LE(uncompressedSize, offset + 22);
    offset = buffer.indexOf(localHeaderSignature, offset + localHeaderSignature.length);
  }

  offset = buffer.indexOf(centralDirectorySignature);
  while (offset !== -1) {
    buffer.writeUInt32LE(uncompressedSize, offset + 24);
    offset = buffer.indexOf(centralDirectorySignature, offset + centralDirectorySignature.length);
  }

  return toArrayBuffer(buffer);
}

function makeUploadSupabase(options?: {
  userId?: string | null;
  conversation?: { id: string } | null;
  pendingAttachments?: Array<{ id: string }>;
  attachments?: Array<Record<string, unknown>>;
  insertError?: { message: string } | null;
}) {
  const userId = options?.userId ?? 'user-1';
  const attachmentRows = (options?.attachments ?? []).map((row) => ({ ...row }));
  const upload = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async () => ({ error: null }));

  const conversationsQuery = {
    select: vi.fn(() => conversationsQuery),
    eq: vi.fn(() => conversationsQuery),
    maybeSingle: vi.fn(async () => ({
      data: options?.conversation === undefined ? { id: '22222222-2222-4222-8222-222222222222' } : options.conversation,
      error: null,
    })),
  };

  const pendingQuery = {
    data: options?.pendingAttachments ?? [],
    error: null,
    select: vi.fn(() => pendingQuery),
    eq: vi.fn(() => pendingQuery),
  };

  type QueryFilter = { column: string; value: unknown };
  const matchesFilters = (row: Record<string, unknown>, filters: QueryFilter[]) =>
    filters.every((filter) => row[filter.column] === filter.value);

  const attachmentSelectFilters: QueryFilter[] = [];
  const attachmentSelectQuery = {
    eq: vi.fn((column: string, value: unknown) => {
      attachmentSelectFilters.push({ column, value });
      return attachmentSelectQuery;
    }),
    in: vi.fn(async (column: string, values: unknown[]) => ({
      data: attachmentRows.filter(
        (row) => values.includes(row[column]) && matchesFilters(row, attachmentSelectFilters),
      ),
      error: null,
    })),
  };

  const attachmentUpdateFilters: QueryFilter[] = [];
  let attachmentUpdatePayload: Record<string, unknown> = {};
  let attachmentUpdatedIds: string[] = [];
  const attachmentUpdateQuery = {
    eq: vi.fn((column: string, value: unknown) => {
      attachmentUpdateFilters.push({ column, value });
      return attachmentUpdateQuery;
    }),
    in: vi.fn((column: string, values: unknown[]) => {
      attachmentUpdatedIds = [];
      for (const row of attachmentRows) {
        if (values.includes(row[column]) && matchesFilters(row, attachmentUpdateFilters)) {
          Object.assign(row, attachmentUpdatePayload);
          attachmentUpdatedIds.push(String(row.id));
        }
      }
      return attachmentUpdateQuery;
    }),
    select: vi.fn(async () => ({
      data: attachmentUpdatedIds.map((id) => ({ id })),
      error: null,
    })),
  };

  const insertQuery = {
    select: vi.fn(() => insertQuery),
    single: vi.fn(async () => ({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
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
    select: vi.fn((columns?: string) => columns?.includes('storage_path') ? attachmentSelectQuery : pendingQuery),
    insert: vi.fn(() => insertQuery),
    update: vi.fn((payload: Record<string, unknown>) => {
      attachmentUpdateFilters.length = 0;
      attachmentUpdatePayload = payload;
      return attachmentUpdateQuery;
    }),
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
    attachmentRows,
    attachmentSelectQuery,
    attachmentUpdateQuery,
  };
}

function makeAttachmentForm(file = new File(['hello world'], 'notes.txt', { type: 'text/plain' })) {
  const formData = new FormData();
  formData.set('file', file);
  formData.set('conversationId', '22222222-2222-4222-8222-222222222222');
  return formData;
}

describe('POST /api/chat/attachments', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
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

  it('rejects oversized multipart bodies before parsing form data', async () => {
    const supabase = makeUploadSupabase();
    createClient.mockReturnValue(supabase.client);
    const request = makeRequest(makeAttachmentForm(), {
      authorization: 'Bearer session-token',
      'content-length': String(11 * 1024 * 1024 + 1),
    });

    const { POST } = await import('../route');
    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Attachment upload exceeds the request size limit',
    });
    expect(request.formData).not.toHaveBeenCalled();
    expect(parseAttachment).not.toHaveBeenCalled();
    expect(supabase.upload).not.toHaveBeenCalled();
  });

  it('rejects upload requests without a bounded Content-Length before parsing form data', async () => {
    const supabase = makeUploadSupabase();
    createClient.mockReturnValue(supabase.client);
    const request = makeRequest(makeAttachmentForm(), {
      authorization: 'Bearer session-token',
    }, { omitDefaultContentLength: true });

    const { POST } = await import('../route');
    const response = await POST(request);

    expect(response.status).toBe(411);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Attachment upload requires a bounded Content-Length header',
    });
    expect(request.formData).not.toHaveBeenCalled();
    expect(parseAttachment).not.toHaveBeenCalled();
    expect(supabase.upload).not.toHaveBeenCalled();
  });

  it('rejects malformed conversation ids before upload queries', async () => {
    const supabase = makeUploadSupabase();
    createClient.mockReturnValue(supabase.client);
    const formData = makeAttachmentForm();
    formData.set('conversationId', 'not-a-uuid');

    const { POST } = await import('../route');
    const response = await POST(makeRequest(formData, {
      authorization: 'Bearer session-token',
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: 'conversationId must be a valid UUID',
    });
    expect(supabase.conversationsQuery.maybeSingle).not.toHaveBeenCalled();
    expect(supabase.upload).not.toHaveBeenCalled();
  });

  it('rejects docx files whose archive expands beyond the extraction limit', async () => {
    const supabase = makeUploadSupabase();
    createClient.mockReturnValue(supabase.client);

    const { POST } = await import('../route');
    const response = await POST(makeRequest(makeAttachmentForm(
      new File(
        [makeZipWithEntryUncompressedSize(60 * 1024 * 1024)],
        'large.docx',
        { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      ),
    ), {
      authorization: 'Bearer session-token',
    }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Attachment document expands beyond the safe extraction limit',
    });
    expect(parseAttachment).not.toHaveBeenCalled();
    expect(supabase.upload).not.toHaveBeenCalled();
  });

  it('rejects docx files that underreport their inflated archive size', async () => {
    const supabase = makeUploadSupabase();
    createClient.mockReturnValue(supabase.client);
    const zip = await makeZipWithEntryContent(Buffer.alloc(50 * 1024 * 1024 + 1));
    const underreportedZip = rewriteZipUncompressedSizes(zip, 1);

    const { POST } = await import('../route');
    const response = await POST(makeRequest(makeAttachmentForm(
      new File(
        [underreportedZip],
        'underreported.docx',
        { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      ),
    ), {
      authorization: 'Bearer session-token',
    }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Attachment document expands beyond the safe extraction limit',
    });
    expect(parseAttachment).not.toHaveBeenCalled();
    expect(supabase.upload).not.toHaveBeenCalled();
  });

  it('times out docx archive inspection before parser work receives a fresh budget', async () => {
    const supabase = makeUploadSupabase();
    createClient.mockReturnValue(supabase.client);
    const zip = await makeZipWithEntryContent(Buffer.from('<document />'));
    const nowSpy = vi.spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValue(15_000);

    try {
      const { POST } = await import('../route');
      const response = await POST(makeRequest(makeAttachmentForm(
        new File(
          [zip],
          'slow-inspection.docx',
          { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        ),
      ), {
        authorization: 'Bearer session-token',
      }));

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Attachment text extraction timed out',
      });
      expect(parseAttachment).not.toHaveBeenCalled();
      expect(supabase.upload).not.toHaveBeenCalled();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('times out slow text extraction before upload', async () => {
    vi.useFakeTimers();
    try {
      const supabase = makeUploadSupabase();
      createClient.mockReturnValue(supabase.client);
      parseAttachment.mockImplementation(() => new Promise(() => undefined));

      const { POST } = await import('../route');
      const responsePromise = POST(makeRequest(makeAttachmentForm(), {
        authorization: 'Bearer session-token',
      }));

      await vi.advanceTimersByTimeAsync(15_000);
      const response = await responsePromise;

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Attachment text extraction timed out',
      });
      expect(supabase.upload).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('times out parser work that spends the budget before yielding', async () => {
    const supabase = makeUploadSupabase();
    createClient.mockReturnValue(supabase.client);
    let now = 0;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);
    parseAttachment.mockImplementation(() => {
      now = 15_000;
      return Promise.resolve({
        text: 'late parse',
        metadata: { encoding: 'utf8' },
        fileType: 'txt',
      });
    });

    try {
      const { POST } = await import('../route');
      const response = await POST(makeRequest(makeAttachmentForm(), {
        authorization: 'Bearer session-token',
      }));

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Attachment text extraction timed out',
      });
      expect(supabase.upload).not.toHaveBeenCalled();
    } finally {
      nowSpy.mockRestore();
    }
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
        id: '11111111-1111-4111-8111-111111111111',
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
      expect.stringMatching(/^user-1\/22222222-2222-4222-8222-222222222222\/[0-9a-f-]+\/notes\.txt$/),
      expect.any(File),
      expect.objectContaining({ contentType: 'text/plain', upsert: false }),
    );
    expect(supabase.chatAttachmentsTable.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      conversation_id: '22222222-2222-4222-8222-222222222222',
      filename: 'notes.txt',
      extracted_text: 'hello world',
      extracted_chars: 11,
      status: 'uploaded',
    }));
    expect(createClient).toHaveBeenNthCalledWith(
      2,
      'https://example.supabase.co',
      'service-role-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: false,
          persistSession: false,
        }),
      }),
    );
  });

  it('accepts TypeScript attachments reported with the common video/mp2t MIME type', async () => {
    const supabase = makeUploadSupabase();
    createClient.mockReturnValue(supabase.client);

    const { POST } = await import('../route');
    const response = await POST(makeRequest(makeAttachmentForm(
      new File(['const answer: number = 42;'], 'example.ts', { type: 'video/mp2t' }),
    ), {
      authorization: 'Bearer session-token',
    }));

    expect(response.status).toBe(201);
    expect(parseAttachment).toHaveBeenCalledWith(expect.any(Buffer), 'ts');
    expect(supabase.chatAttachmentsTable.insert).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'example.ts',
      content_type: 'video/mp2t',
      kind: 'code',
    }));
  });
});

describe('DELETE /api/chat/attachments', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('deletes uploaded attachments so abandoned pending files stop counting against capacity', async () => {
    const supabase = makeUploadSupabase({
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/notes.txt',
          status: 'uploaded',
        },
      ],
    });
    createClient.mockReturnValue(supabase.client);

    const { DELETE } = await import('../route');
    const response = await DELETE(makeJsonRequest({
      conversationId: '22222222-2222-4222-8222-222222222222',
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
    }, {
      authorization: 'Bearer session-token',
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      deletedIds: ['11111111-1111-4111-8111-111111111111'],
    });
    expect(supabase.attachmentRows[0].status).toBe('deleted');
    expect(supabase.attachmentSelectQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(supabase.attachmentSelectQuery.eq).toHaveBeenCalledWith('conversation_id', '22222222-2222-4222-8222-222222222222');
    expect(supabase.attachmentSelectQuery.eq).toHaveBeenCalledWith('status', 'uploaded');
    expect(supabase.attachmentUpdateQuery.eq).toHaveBeenCalledWith('status', 'uploaded');
    expect(supabase.remove).toHaveBeenCalledWith(['user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/notes.txt']);
  });

  it('rejects malformed attachment ids before deletion queries', async () => {
    const supabase = makeUploadSupabase();
    createClient.mockReturnValue(supabase.client);

    const { DELETE } = await import('../route');
    const response = await DELETE(makeJsonRequest({
      conversationId: '22222222-2222-4222-8222-222222222222',
      attachmentIds: ['not-a-uuid'],
    }, {
      authorization: 'Bearer session-token',
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: 'attachmentIds must contain valid UUIDs',
    });
    expect(supabase.chatAttachmentsTable.update).not.toHaveBeenCalled();
    expect(supabase.remove).not.toHaveBeenCalled();
  });

  it('rejects malformed conversation ids before deletion queries', async () => {
    const supabase = makeUploadSupabase();
    createClient.mockReturnValue(supabase.client);

    const { DELETE } = await import('../route');
    const response = await DELETE(makeJsonRequest({
      conversationId: 'not-a-uuid',
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
    }, {
      authorization: 'Bearer session-token',
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: 'conversationId must be a valid UUID',
    });
    expect(supabase.chatAttachmentsTable.update).not.toHaveBeenCalled();
    expect(supabase.remove).not.toHaveBeenCalled();
  });

  it('refuses to delete attachments that are no longer pending uploads', async () => {
    const supabase = makeUploadSupabase({
      attachments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'user-1',
          conversation_id: '22222222-2222-4222-8222-222222222222',
          storage_bucket: 'chat-attachments',
          storage_path: 'user-1/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/notes.txt',
          status: 'attached',
        },
      ],
    });
    createClient.mockReturnValue(supabase.client);

    const { DELETE } = await import('../route');
    const response = await DELETE(makeJsonRequest({
      conversationId: '22222222-2222-4222-8222-222222222222',
      attachmentIds: ['11111111-1111-4111-8111-111111111111'],
    }, {
      authorization: 'Bearer session-token',
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Only uploaded attachments can be deleted before send',
    });
    expect(supabase.attachmentRows[0].status).toBe('attached');
    expect(supabase.remove).not.toHaveBeenCalled();
  });
});
