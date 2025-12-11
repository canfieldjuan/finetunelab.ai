/**
 * Judgments API - Get judgments for a specific message
 * GET /api/judgments/[messageId]
 * Returns all validator judgments for a message
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch judgments for this message
    // RLS policy ensures user can only see judgments for their own messages
    const { data: judgments, error } = await supabase
      .from('judgments')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[JudgmentsAPI] Error fetching judgments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      judgments: judgments || [],
      count: judgments?.length || 0,
    });

  } catch (error) {
    console.error('[JudgmentsAPI] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
