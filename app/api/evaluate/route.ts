// API endpoint for message evaluation
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { messageId, rating, success, failureTags, notes, expectedBehavior, actualBehavior } = await req.json();

    // Get auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized - no auth header' }, { status: 401 });
    }

    // Create authenticated Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized - invalid token' }, { status: 401 });
    }

    console.log('[Evaluate] Inserting evaluation for message:', messageId, 'user:', user.id);

    // Get trace_id for this message (if exists)
    let traceId: string | undefined;
    const { data: trace } = await supabase
      .from('llm_traces')
      .select('trace_id')
      .eq('message_id', messageId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (trace) {
      traceId = trace.trace_id;
    }

    // Insert or update evaluation
    const { data, error } = await supabase
      .from('message_evaluations')
      .upsert({
        message_id: messageId,
        user_id: user.id, // Fixed: was evaluator_id, should be user_id
        rating,
        success,
        notes,
        trace_id: traceId,
        // Store additional fields in metadata JSON
        metadata: {
          failure_tags: failureTags || [],
          expected_behavior: expectedBehavior,
          actual_behavior: actualBehavior,
        },
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
