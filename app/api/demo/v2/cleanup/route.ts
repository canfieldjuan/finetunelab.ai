/**
 * Demo V2 Cleanup API
 * POST /api/demo/v2/cleanup - Delete all demo session data
 *
 * Deletes:
 * - demo_model_configs (including encrypted API key)
 * - demo_batch_test_runs for session
 * - demo_batch_test_results for session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { session_id } = await req.json();

    if (!session_id) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Track what was deleted
    const deletionResults = {
      configDeleted: false,
      testRunsDeleted: 0,
      resultsDeleted: 0,
    };

    // 1. Delete batch test results
    const { data: results, error: resultsError } = await supabase
      .from('demo_batch_test_results')
      .delete()
      .eq('demo_session_id', session_id)
      .select('id');

    if (resultsError) {
      console.error('[DemoCleanup] Error deleting results:', resultsError);
    } else {
      deletionResults.resultsDeleted = results?.length || 0;
    }

    // 2. Delete batch test runs
    const { data: runs, error: runsError } = await supabase
      .from('demo_batch_test_runs')
      .delete()
      .eq('demo_session_id', session_id)
      .select('id');

    if (runsError) {
      console.error('[DemoCleanup] Error deleting runs:', runsError);
    } else {
      deletionResults.testRunsDeleted = runs?.length || 0;
    }

    // 3. Delete model config (including encrypted API key)
    const { data: config, error: configError } = await supabase
      .from('demo_model_configs')
      .delete()
      .eq('session_id', session_id)
      .select('id');

    if (configError) {
      console.error('[DemoCleanup] Error deleting config:', configError);
    } else {
      deletionResults.configDeleted = (config?.length || 0) > 0;
    }

    console.log(`[DemoCleanup] Cleaned up session ${session_id}:`, deletionResults);

    return NextResponse.json({
      success: true,
      message: 'Session data deleted successfully',
      deleted: {
        config: deletionResults.configDeleted,
        testRuns: deletionResults.testRunsDeleted,
        results: deletionResults.resultsDeleted,
      },
    });
  } catch (error) {
    console.error('[DemoCleanup] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Note: cleanupExpiredDemoSessions moved to lib/demo/cleanup.ts
