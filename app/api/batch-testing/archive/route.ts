/**
 * API Route - Batch Test Run Archive Operations
 *
 * Handles batch test run archiving, restoration, and deletion.
 * POST /api/batch-testing/archive - Archive test runs
 * PATCH /api/batch-testing/archive - Restore test runs
 * DELETE /api/batch-testing/archive - Permanently delete test runs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateRequestWithScope, extractApiKeyFromHeaders } from '@/lib/auth/api-key-validator';

// Use Node.js runtime
export const runtime = 'nodejs';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const API_KEY_PREFIX = 'wak_';

/**
 * Authenticate user helper
 */
async function authenticateUser(req: NextRequest): Promise<
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

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized - invalid token' };
  }

  return { ok: true, userId: user.id, mode: 'session', authorizationHeader: authHeader };
}

/**
 * POST - Archive batch test runs
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateUser(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Parse request body
    const { testRunIds } = await req.json();

    // Validate test run IDs
    if (!testRunIds || !Array.isArray(testRunIds) || testRunIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid testRunIds array' },
        { status: 400 }
      );
    }

    console.log('[BatchTestArchive] Archiving test runs:', {
      userId: auth.userId,
      count: testRunIds.length
    });

    // Use service key to update archived status
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error: updateError } = await supabaseAdmin
      .from('batch_test_runs')
      .update({ archived: true })
      .in('id', testRunIds)
      .eq('user_id', auth.userId)
      .select('id');

    if (updateError) {
      console.error('[BatchTestArchive] Error:', updateError);
      throw new Error(updateError.message);
    }

    const archivedCount = data?.length || 0;

    console.log('[BatchTestArchive] Archived successfully:', {
      archivedCount
    });

    return NextResponse.json({
      success: true,
      archivedCount,
      archivedIds: data?.map(r => r.id) || []
    });

  } catch (error) {
    console.error('[BatchTestArchive] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Restore archived batch test runs
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await authenticateUser(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Parse request body
    const { testRunIds } = await req.json();

    // Validate test run IDs
    if (!testRunIds || !Array.isArray(testRunIds) || testRunIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid testRunIds array' },
        { status: 400 }
      );
    }

    console.log('[BatchTestArchive] Restoring test runs:', {
      userId: auth.userId,
      count: testRunIds.length
    });

    // Use service key to update archived status
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error: updateError } = await supabaseAdmin
      .from('batch_test_runs')
      .update({ archived: false })
      .in('id', testRunIds)
      .eq('user_id', auth.userId)
      .select('id');

    if (updateError) {
      console.error('[BatchTestArchive] Restore error:', updateError);
      throw new Error(updateError.message);
    }

    const restoredCount = data?.length || 0;

    console.log('[BatchTestArchive] Restored successfully:', {
      restoredCount
    });

    return NextResponse.json({
      success: true,
      restoredCount,
      restoredIds: data?.map(r => r.id) || []
    });

  } catch (error) {
    console.error('[BatchTestArchive] Restore error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Permanently delete batch test runs
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticateUser(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Parse request body
    const { testRunIds } = await req.json();

    // Validate test run IDs
    if (!testRunIds || !Array.isArray(testRunIds) || testRunIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid testRunIds array' },
        { status: 400 }
      );
    }

    console.log('[BatchTestArchive] Deleting test runs:', {
      userId: auth.userId,
      count: testRunIds.length
    });

    // Use service key to delete
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error: deleteError } = await supabaseAdmin
      .from('batch_test_runs')
      .delete()
      .in('id', testRunIds)
      .eq('user_id', auth.userId)
      .select('id');

    if (deleteError) {
      console.error('[BatchTestArchive] Delete error:', deleteError);
      throw new Error(deleteError.message);
    }

    const deletedCount = data?.length || 0;

    console.log('[BatchTestArchive] Deleted successfully:', {
      deletedCount
    });

    return NextResponse.json({
      success: true,
      deletedCount,
      deletedIds: data?.map(r => r.id) || []
    });

  } catch (error) {
    console.error('[BatchTestArchive] Delete error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
