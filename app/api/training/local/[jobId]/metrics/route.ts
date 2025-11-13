/**
 * Local Training Job Metrics History API
 * GET /api/training/local/[jobId]/metrics
 *
 * Purpose: Get full metrics history from database for charting and analysis
 * Queries: local_training_metrics table in Supabase
 *
 * Phase 3: Database Integration
 * Date: 2025-10-27
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[LocalTraining Metrics GET] CRITICAL: Missing environment variables!');
  console.error('[LocalTraining Metrics GET] NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('[LocalTraining Metrics GET] SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'SET' : 'MISSING');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  console.log('[LocalTraining Metrics GET] Fetching metrics from database for job:', jobId);

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials' },
      { status: 500 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('local_training_metrics')
      .select('*')
      .eq('job_id', jobId)
      .order('step', { ascending: true });

    if (error) {
      console.error('[LocalTraining Metrics GET] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch metrics', details: error.message },
        { status: 500 }
      );
    }

    console.log('[LocalTraining Metrics GET] Retrieved', data?.length || 0, 'metric points from database');

    return NextResponse.json({
      job_id: jobId,
      metrics: data || []
    });

  } catch (error) {
    console.error('[LocalTraining Metrics GET] Request error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
