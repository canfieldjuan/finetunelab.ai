/**
 * API Route - Cancel Batch Testing Run
 *
 * Cancels a running or pending batch test by marking it as failed.
 * POST /api/batch-testing/cancel
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { STATUS } from '@/lib/constants';
import { validateRequestWithScope, extractApiKeyFromHeaders } from '@/lib/auth/api-key-validator';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const API_KEY_PREFIX = 'wak_';

async function authenticateBatchTesting(req: NextRequest): Promise<
  | { ok: true; userId: string; mode: 'session' | 'apiKey'; authorizationHeader?: string }
  | { ok: false; status: number; error: string }
> {
  const headerApiKey = req.headers.get('x-api-key') || req.headers.get('x-workspace-api-key');
  const authHeader = req.headers.get('authorization');

  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  const bearerValue = bearerMatch?.[1]?.trim() || null;
  const apiKeyInAuthorization = !!(bearerValue && bearerValue.startsWith(API_KEY_PREFIX));

  if (headerApiKey || apiKeyInAuthorization) {
    const validation = await validateRequestWithScope(req.headers, 'testing');
    if (!validation.isValid || !validation.userId) {
      return {
        ok: false,
        status: validation.scopeError ? 403 : (validation.rateLimitExceeded ? 429 : 401),
        error: validation.errorMessage || 'Unauthorized',
      };
    }

    const extracted = extractApiKeyFromHeaders(req.headers);
    if (!extracted || !extracted.startsWith(API_KEY_PREFIX)) {
      return { ok: false, status: 401, error: 'Invalid API key' };
    }

    return { ok: true, userId: validation.userId, mode: 'apiKey' };
  }

  if (!authHeader) {
    return { ok: false, status: 401, error: 'Unauthorized - no auth header' };
  }

  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseAnon) {
    return { ok: false, status: 500, error: 'Server configuration error' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized - invalid token' };
  }

  return { ok: true, userId: user.id, mode: 'session', authorizationHeader: authHeader };
}

export async function POST(req: NextRequest) {
  try {
    console.log('[Batch Testing Cancel] Request received');

    const authResult = await authenticateBatchTesting(req);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
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
    if (testRun.user_id !== authResult.userId) {
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
