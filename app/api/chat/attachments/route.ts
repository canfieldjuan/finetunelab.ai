import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  ChatAttachmentError,
  createChatAttachmentFromFile,
} from '@/lib/chat/attachments';

export const runtime = 'nodejs';
export const maxDuration = 60;

const FALLBACK_SUPABASE_URL = 'https://xxxxxxxxxxxxx.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return (
    !!value &&
    typeof value === 'object' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'size' in value &&
    typeof value.size === 'number' &&
    'arrayBuffer' in value &&
    typeof value.arrayBuffer === 'function'
  );
}

function createAuthenticatedClient(authHeader: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(authHeader);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const conversationId = formData.get('conversationId');

    if (!isUploadFile(file)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    if (typeof conversationId !== 'string' || !conversationId.trim()) {
      return NextResponse.json({ success: false, error: 'conversationId is required' }, { status: 400 });
    }

    const attachment = await createChatAttachmentFromFile({
      supabase,
      userId: user.id,
      conversationId: conversationId.trim(),
      file,
    });

    return NextResponse.json({ success: true, attachment }, { status: 201 });
  } catch (error) {
    if (error instanceof ChatAttachmentError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    console.error('[Chat Attachments API] Upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload chat attachment' },
      { status: 500 },
    );
  }
}
