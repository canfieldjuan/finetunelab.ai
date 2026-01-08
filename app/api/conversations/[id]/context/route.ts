/**
 * Conversation Context API
 * GET: Fetch context tracker state for a conversation
 * POST: Save/Update context tracker state
 * Date: 2025-10-24
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations/[id]/context
 * Fetch all model contexts for a conversation
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create Supabase client with user's token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const conversationId = params.id;

    // Verify user owns this conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or unauthorized' },
        { status: 404 }
      );
    }

    // Fetch all model contexts for this conversation
    const { data: contexts, error } = await supabase
      .from('conversation_model_contexts')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('[Context API] Error fetching contexts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch context data', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      conversationId,
      contexts: contexts || [],
    });
  } catch (error) {
    console.error('[Context API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations/[id]/context
 * Save or update context for a specific model in the conversation
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create Supabase client with user's token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const conversationId = params.id;
    const body = await request.json();

    // Validate required fields
    const {
      model_id,
      total_tokens,
      input_tokens,
      output_tokens,
      graphrag_tokens,
      message_count,
      first_message_at,
      last_message_at,
    } = body;

    if (model_id === undefined || total_tokens === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: model_id, total_tokens' },
        { status: 400 }
      );
    }

    // Verify user owns this conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or unauthorized' },
        { status: 404 }
      );
    }

    // Upsert context data
    const { data, error } = await supabase
      .from('conversation_model_contexts')
      .upsert(
        {
          conversation_id: conversationId,
          model_id,
          total_tokens: total_tokens || 0,
          input_tokens: input_tokens || 0,
          output_tokens: output_tokens || 0,
          graphrag_tokens: graphrag_tokens || 0,
          message_count: message_count || 0,
          first_message_at: first_message_at || null,
          last_message_at: last_message_at || new Date().toISOString(),
        },
        {
          onConflict: 'conversation_id,model_id',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      console.error('[Context API] Error saving context:', error);
      return NextResponse.json(
        { error: 'Failed to save context data', details: error.message },
        { status: 500 }
      );
    }

    console.log('[Context API] Context saved:', {
      conversationId,
      modelId: model_id,
      totalTokens: total_tokens,
      messageCount: message_count,
    });

    return NextResponse.json({
      success: true,
      context: data,
    });
  } catch (error) {
    console.error('[Context API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
