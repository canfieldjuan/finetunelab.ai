// API endpoint for message evaluation
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { messageId, rating, success, failureTags, notes, expectedBehavior, actualBehavior } = await req.json();

    // Get user from auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Insert or update evaluation
    const { data, error } = await supabase
      .from('message_evaluations')
      .upsert({
        message_id: messageId,
        evaluator_id: user.id,
        rating,
        success,
        failure_tags: failureTags || [],
        notes,
        expected_behavior: expectedBehavior,
        actual_behavior: actualBehavior,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Evaluation error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[API] Evaluation saved for message:', messageId, 'rating:', rating, 'success:', success);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('[API] Evaluation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
