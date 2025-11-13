/**
 * Conversation Sentiment Analysis API Route
 *
 * Analyzes sentiment for a specific conversation.
 *
 * Path Parameters:
 * - id: Conversation ID
 *
 * Phase 3.3: Advanced Sentiment Analysis
 * Date: 2025-10-25
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeConversationSentiment } from '@/lib/services/sentiment.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[Conversation Sentiment API] GET request for conversation:', id);

  try {
    // Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Conversation Sentiment API] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const conversationId = id;

    const { data: conversation } = await supabase
      .from('conversations')
      .select('user_id')
      .eq('id', conversationId)
      .single();

    if (!conversation || conversation.user_id !== user.id) {
      console.log('[Conversation Sentiment API] Conversation not found or unauthorized');
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    console.log('[Conversation Sentiment API] Analyzing conversation:', conversationId);

    const sentiment = await analyzeConversationSentiment(conversationId, supabase);

    console.log('[Conversation Sentiment API] Analysis complete');
    return NextResponse.json({ sentiment }, { status: 200 });
  } catch (error) {
    console.error('[Conversation Sentiment API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
