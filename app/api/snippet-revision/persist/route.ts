import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

interface PersistSnippetRevisionRequest {
  messageId: string;
  conversationId: string;
  expectedContent: string;
  updatedText: string;
}

type AuthResult =
  | { ok: true; userId: string; supabase: SupabaseClient }
  | { ok: false; code: string; message: string; status: number };

type ParseResult =
  | { ok: true; request: PersistSnippetRevisionRequest }
  | { ok: false; code: string; message: string };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_CONTENT_CHARS = 200_000;

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return validationError(auth.code, auth.message, auth.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError('invalid_json', 'Request body must be valid JSON.');
  }

  const parsed = parsePersistRequest(body);
  if (!parsed.ok) {
    return validationError(parsed.code, parsed.message);
  }

  const { request: persistRequest } = parsed;
  const { data, error } = await auth.supabase.rpc('update_assistant_message_content_if_current', {
    p_message_id: persistRequest.messageId,
    p_conversation_id: persistRequest.conversationId,
    p_expected_content: persistRequest.expectedContent,
    p_updated_content: persistRequest.updatedText,
  });

  if (error) {
    console.error('[SnippetRevisionPersist] Failed to save revised message:', error);
    return validationError('save_failed', 'Failed to save revised message.', 500);
  }

  if (!Array.isArray(data) || data.length !== 1) {
    return validationError(
      'message_changed',
      'Message changed before the revision could be saved. Reload and try again.',
      409,
    );
  }

  return NextResponse.json({
    ok: true,
    messageId: persistRequest.messageId,
  });
}

async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return {
      ok: false,
      code: 'unauthorized',
      message: 'Authorization header is required.',
      status: 401,
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[SnippetRevisionPersist] Missing Supabase public environment variables.');
    return {
      ok: false,
      code: 'server_config_error',
      message: 'Snippet revision persistence is not configured.',
      status: 500,
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      ok: false,
      code: 'unauthorized',
      message: 'Invalid authorization token.',
      status: 401,
    };
  }

  return { ok: true, userId: user.id, supabase };
}

function parsePersistRequest(body: unknown): ParseResult {
  if (!isRecord(body)) {
    return failure('invalid_body', 'Request body must be a JSON object.');
  }

  const { messageId, conversationId, expectedContent, updatedText } = body;
  if (typeof messageId !== 'string' || !UUID_REGEX.test(messageId)) {
    return failure('invalid_message_id', 'messageId must be a saved message UUID.');
  }

  if (typeof conversationId !== 'string' || !UUID_REGEX.test(conversationId)) {
    return failure('invalid_conversation_id', 'conversationId must be a conversation UUID.');
  }

  if (typeof expectedContent !== 'string') {
    return failure('invalid_expected_content', 'expectedContent must be a string.');
  }

  if (typeof updatedText !== 'string') {
    return failure('invalid_updated_text', 'updatedText must be a string.');
  }

  if (expectedContent.length > MAX_MESSAGE_CONTENT_CHARS || updatedText.length > MAX_MESSAGE_CONTENT_CHARS) {
    return failure(
      'message_content_too_large',
      `Message content must be ${MAX_MESSAGE_CONTENT_CHARS} characters or fewer.`,
    );
  }

  return {
    ok: true,
    request: {
      messageId,
      conversationId,
      expectedContent,
      updatedText,
    },
  };
}

function validationError(code: string, message: string, status = 400) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

function failure(code: string, message: string): { ok: false; code: string; message: string } {
  return {
    ok: false,
    code,
    message,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
