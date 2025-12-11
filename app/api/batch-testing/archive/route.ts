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

// Use Node.js runtime
export const runtime = 'nodejs';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Authenticate user helper
 */
async function authenticateUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return { error: 'Unauthorized - no auth header', user: null };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: 'Unauthorized - invalid token', user: null };
  }

  return { error: null, user };
}

/**
 * POST - Archive batch test runs
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await authenticateUser(req);
    if (error || !user) {
      return NextResponse.json({ error }, { status: 401 });
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
      userId: user.id,
      count: testRunIds.length
    });

    // Use service key to update archived status
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error: updateError } = await supabaseAdmin
      .from('batch_test_runs')
      .update({ archived: true })
      .in('id', testRunIds)
      .eq('user_id', user.id)
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
    const { error, user } = await authenticateUser(req);
    if (error || !user) {
      return NextResponse.json({ error }, { status: 401 });
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
      userId: user.id,
      count: testRunIds.length
    });

    // Use service key to update archived status
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error: updateError } = await supabaseAdmin
      .from('batch_test_runs')
      .update({ archived: false })
      .in('id', testRunIds)
      .eq('user_id', user.id)
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
    const { error, user } = await authenticateUser(req);
    if (error || !user) {
      return NextResponse.json({ error }, { status: 401 });
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
      userId: user.id,
      count: testRunIds.length
    });

    // Use service key to delete
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error: deleteError } = await supabaseAdmin
      .from('batch_test_runs')
      .delete()
      .in('id', testRunIds)
      .eq('user_id', user.id)
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
