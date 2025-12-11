/**
 * API Route - Cancel Batch Testing Run
 *
 * Cancels a running or pending batch test by marking it as failed.
 * POST /api/batch-testing/cancel
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { STATUS } from '@/lib/constants';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    console.log('[Batch Testing Cancel] Request received');

    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    // Create authenticated Supabase client
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { test_run_id } = body;

    if (!test_run_id) {
      return NextResponse.json(
        { error: 'Missing test_run_id' },
        { status: 400 }
      );
    }

    console.log('[Batch Testing Cancel] Cancelling test run:', test_run_id);

    // Use service key to update the batch test run
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // First verify the test run belongs to the user
    const { data: testRun, error: fetchError } = await supabaseAdmin
      .from('batch_test_runs')
      .select('user_id, status')
      .eq('id', test_run_id)
      .single();

    if (fetchError || !testRun) {
      console.error('[Batch Testing Cancel] Test run not found:', fetchError);
      return NextResponse.json(
        { error: 'Test run not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (testRun.user_id !== user.id) {
      console.error('[Batch Testing Cancel] User does not own this test run');
      return NextResponse.json(
        { error: 'Unauthorized - not your test run' },
        { status: 403 }
      );
    }

    // Check if test is still running or pending
    if (testRun.status !== STATUS.RUNNING && testRun.status !== STATUS.PENDING) {
      return NextResponse.json(
        { error: `Cannot cancel test with status: ${testRun.status}` },
        { status: 400 }
      );
    }

    // Update status to cancelled
    const { error: updateError } = await supabaseAdmin
      .from('batch_test_runs')
      .update({
        status: STATUS.FAILED,
        error: 'Cancelled by user',
        completed_at: new Date().toISOString()
      })
      .eq('id', test_run_id);

    if (updateError) {
      console.error('[Batch Testing Cancel] Failed to cancel:', updateError);
      return NextResponse.json(
        { error: 'Failed to cancel test run' },
        { status: 500 }
      );
    }

    console.log('[Batch Testing Cancel] Test run cancelled successfully');

    return NextResponse.json({
      success: true,
      message: 'Test run cancelled'
    });

  } catch (error) {
    console.error('[Batch Testing Cancel] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
