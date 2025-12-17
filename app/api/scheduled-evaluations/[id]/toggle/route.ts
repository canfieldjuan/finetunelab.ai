/**
 * API Route - Toggle Scheduled Evaluation Active Status
 *
 * POST /api/scheduled-evaluations/[id]/toggle - Toggle is_active boolean
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ScheduledEvaluation } from '@/lib/batch-testing/types';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST - Toggle is_active status (true <-> false)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[Scheduled Evaluations API] POST - Toggle schedule:', id);

  try {
    // Block 1: Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('[Scheduled Evaluations API] No auth header');
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[Scheduled Evaluations API] Invalid token:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    console.log('[Scheduled Evaluations API] User authenticated:', user.id);

    // Block 2: Fetch current schedule to get is_active value
    const supabaseRead = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: existingSchedule, error: fetchError } = await supabaseRead
      .from('scheduled_evaluations')
      .select('id, is_active')
      .eq('id', id)
      .single();

    if (fetchError || !existingSchedule) {
      console.log('[Scheduled Evaluations API] Schedule not found:', fetchError?.message);
      return NextResponse.json(
        { error: 'Scheduled evaluation not found or access denied' },
        { status: 404 }
      );
    }

    const newIsActive = !existingSchedule.is_active;
    console.log('[Scheduled Evaluations API] Toggling is_active:', existingSchedule.is_active, '->', newIsActive);

    // Block 3: Update is_active (use service key for write)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: updatedSchedule, error: updateError } = await supabaseAdmin
      .from('scheduled_evaluations')
      .update({ is_active: newIsActive })
      .eq('id', id)
      .eq('user_id', user.id)  // Double-check ownership
      .select()
      .single();

    if (updateError || !updatedSchedule) {
      console.error('[Scheduled Evaluations API] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to toggle scheduled evaluation: ' + updateError?.message },
        { status: 500 }
      );
    }

    console.log('[Scheduled Evaluations API] Schedule toggled:', updatedSchedule.id, 'is_active:', updatedSchedule.is_active);

    return NextResponse.json({
      success: true,
      data: updatedSchedule as ScheduledEvaluation,
    });

  } catch (error) {
    console.error('[Scheduled Evaluations API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
