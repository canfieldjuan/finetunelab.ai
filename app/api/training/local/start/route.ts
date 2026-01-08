/**
 * Local Training Start API Route
 *
 * Starts training on the local training server (localhost:8000)
 * This proxies browser requests through the Next.js backend to avoid CORS/localhost issues
 *
 * Date: 2025-11-26
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { trainingDeploymentService } from '@/lib/training/training-deployment.service';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

export async function POST(request: NextRequest) {
  console.log('[Local Training Start] POST request received');

  try {
    // Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Local Training Start] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate request body
    if (!body.config_id) {
      return NextResponse.json(
        { error: 'Missing required field: config_id' },
        { status: 400 }
      );
    }

    console.log('[Local Training Start] Config ID:', body.config_id);
    console.log('[Local Training Start] User ID:', user.id);

    // Fetch config data
    const { data: configData, error: configError } = await supabase
      .from('training_configs')
      .select('id, name, config_json')
      .eq('id', body.config_id)
      .eq('user_id', user.id) // Ensure user owns this config
      .single();

    if (configError || !configData) {
      console.error('[Local Training Start] Config not found:', body.config_id);
      return NextResponse.json(
        { error: 'Training config not found or access denied' },
        { status: 404 }
      );
    }

    console.log('[Local Training Start] Config loaded:', configData.name);

    const executionId = body.execution_id || crypto.randomUUID();
    const modelName = body.name || configData.name;
    const datasetPath = body.dataset_path || '';

    console.log('[Local Training Start] Submitting job to training server');
    console.log('[Local Training Start] Execution ID:', executionId);
    console.log('[Local Training Start] Dataset path:', datasetPath);

    // Use unified service
    const jobId = await trainingDeploymentService.deployJob(
      'local',
      configData.config_json,
      modelName,
      datasetPath,
      {
        jobId: executionId,
        userId: user.id,
        accessToken: authHeader.replace('Bearer ', '')
      }
    );

    console.log('[Local Training Start] Job submitted successfully');
    console.log('[Local Training Start] Job ID:', jobId);

    return NextResponse.json({
      success: true,
      job_id: jobId,
      message: 'Training started successfully',
    }, { status: 200 });

  } catch (error) {
    console.error('[Local Training Start] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
