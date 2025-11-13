/**
 * Training Jobs API
 * GET - List user's recent training jobs from local_training_jobs table
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  console.log('[Training Jobs API] GET request');

  try {
    // Get auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[Training Jobs API] Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Training Jobs API] Fetching jobs for user:', user.id);

    // Fetch recent training jobs (last 20)
    const { data: jobs, error: fetchError } = await supabase
      .from('local_training_jobs')
      .select('id, model_name, status, started_at, completed_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (fetchError) {
      console.error('[Training Jobs API] Fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch training jobs' },
        { status: 500 }
      );
    }

    console.log('[Training Jobs API] Found', jobs?.length || 0, 'jobs');

    return NextResponse.json({
      success: true,
      count: jobs?.length || 0,
      jobs: jobs || [],
    });

  } catch (error) {
    console.error('[Training Jobs API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
