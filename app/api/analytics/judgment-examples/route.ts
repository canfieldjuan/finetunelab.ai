/**
 * API Route - Judgment Examples by Tag
 * GET /api/analytics/judgment-examples?tag=hallucination&page=1&pageSize=10&startDate=...&endDate=...
 * Auth required (Supabase JWT via Authorization bearer)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  console.log('[Judgment Examples API] Request received');

  try {
    // Auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[Judgment Examples API] Invalid token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Params
    const { searchParams } = new URL(req.url);
    const tag = (searchParams.get('tag') || '').trim();
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const pageSize = Math.min(
      parseInt(process.env.ANALYTICS_JUDGMENT_MAX_PAGE_SIZE || '50', 10),
      Math.max(1, Number(searchParams.get('pageSize') || process.env.ANALYTICS_JUDGMENT_DEFAULT_PAGE_SIZE || '10'))
    );
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    if (!tag) {
      return NextResponse.json({ error: 'Missing tag' }, { status: 400 });
    }

    console.log('[Judgment Examples API] Params:', { tag, page, pageSize, startDate, endDate });

    // Base query for evaluations by tag
    let evalQuery = supabase
      .from('message_evaluations')
      .select('id, message_id, rating, success, failure_tags, created_at', { count: 'exact' })
      .eq('evaluator_id', user.id)
      .contains('failure_tags', [tag])
      .order('created_at', { ascending: false });

    if (startDate) evalQuery = evalQuery.gte('created_at', startDate);
    if (endDate) evalQuery = evalQuery.lte('created_at', endDate);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: evals, error: evalErr, count } = await evalQuery.range(from, to);
    if (evalErr) {
      console.error('[Judgment Examples API] Eval query error:', evalErr);
      return NextResponse.json({ error: 'Failed to query evaluations' }, { status: 500 });
    }

    const messageIds = Array.from(new Set((evals || []).map(e => e.message_id))).filter(Boolean) as string[];
    console.log('[Judgment Examples API] Found evaluations:', { evalCount: evals?.length || 0, uniqueMessages: messageIds.length });

    // Fetch messages for these IDs
    let messages: Array<{
      id: string;
      role: string;
      created_at: string;
      model_id: string | null;
      provider: string | null;
      conversation_id: string | null;
      content?: string | null;
    }> = [];

    if (messageIds.length > 0) {
      const { data: msgData, error: msgErr } = await supabase
        .from('messages')
        .select('id, role, created_at, model_id, provider, conversation_id, content')
        .in('id', messageIds);
      if (msgErr) {
        console.error('[Judgment Examples API] Message query error:', msgErr);
        return NextResponse.json({ error: 'Failed to query messages' }, { status: 500 });
      }
      messages = msgData || [];
    }

    // Join evals with messages
    const messageMap = new Map(messages.map(m => [m.id, m]));
    const items = (evals || []).map(e => {
      const m = messageMap.get(e.message_id);
      return {
        messageId: e.message_id,
        createdAt: m?.created_at || e.created_at,
        role: m?.role || 'assistant',
        modelId: m?.model_id || null,
        provider: m?.provider || null,
        conversationId: m?.conversation_id || null,
        content: m?.content || null,
        rating: e.rating ?? null,
        success: e.success ?? null,
        failureTags: e.failure_tags || [],
      };
    });

    const hasMore = count !== null && typeof count === 'number' ? to + 1 < count : items.length === pageSize;

    return NextResponse.json({ success: true, items, page, pageSize, total: count ?? null, hasMore });
  } catch (error) {
    console.error('[Judgment Examples API] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 });
  }
}
