/**
 * API Route: Check if a training job is a cloud deployment
 * Purpose: Distinguish between local and cloud (RunPod/Lambda) jobs
 * Used by: TrainingMonitor to hide local-only UI elements for cloud jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Get auth header from request
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - No authorization header' },
        { status: 401 }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if job has a cloud deployment record
    // If it has a cloud_deployments record with matching job_id in config, it's a cloud job (RunPod/Lambda)
    const { data: cloudDeployment, error: queryError } = await supabase
      .from('cloud_deployments')
      .select('id, platform')
      .eq('user_id', user.id)
      .eq('config->>job_id', jobId)
      .maybeSingle();

    if (queryError) {
      console.error('[CloudCheck API] Error querying cloud deployments:', queryError);
      return NextResponse.json(
        { error: 'Failed to check cloud deployment status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      isCloudJob: !!cloudDeployment,
      platform: cloudDeployment?.platform || null,
    });

  } catch (error) {
    console.error('[CloudCheck API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
