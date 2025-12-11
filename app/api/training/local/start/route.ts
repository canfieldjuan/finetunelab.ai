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
import { LocalTrainingProvider } from '@/lib/services/training-providers/local.provider';
import { LocalProviderConfig } from '@/lib/training/training-config.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

    // Get provider config
    const providerConfig: LocalProviderConfig = {
      type: 'local',
      base_url: process.env.NEXT_PUBLIC_TRAINING_SERVER_URL || 'http://localhost:8000',
      timeout_ms: parseInt(process.env.TRAINING_PROVIDER_TIMEOUT_MS || '5000', 10),
    };

    console.log('[Local Training Start] Provider config:', providerConfig.base_url);

    // Initialize provider and test connection
    const provider = new LocalTrainingProvider(providerConfig);
    const connectionTest = await provider.validateConnection();

    if (!connectionTest.success) {
      console.error('[Local Training Start] Training server not available:', connectionTest.error);
      return NextResponse.json(
        {
          success: false,
          error: `Training server not available: ${connectionTest.error}`,
        },
        { status: 503 }
      );
    }

    console.log('[Local Training Start] Training server is healthy');

    // Prepare training request
    const trainingRequest = {
      config: configData.config_json,
      dataset_path: body.dataset_path || '',
      execution_id: body.execution_id || crypto.randomUUID(),
      name: body.name || configData.name,
      user_id: user.id,
    };

    console.log('[Local Training Start] Submitting job to training server');
    console.log('[Local Training Start] Execution ID:', trainingRequest.execution_id);
    console.log('[Local Training Start] Dataset path:', trainingRequest.dataset_path);

    // Call training server via provider
    const jobResult = await provider.executeTraining(trainingRequest);

    if (!jobResult.success) {
      console.error('[Local Training Start] Failed to submit job:', jobResult.error);
      return NextResponse.json(
        {
          success: false,
          error: jobResult.error,
        },
        { status: 500 }
      );
    }

    console.log('[Local Training Start] Job submitted successfully');
    console.log('[Local Training Start] Job ID:', jobResult.job_id);

    return NextResponse.json({
      success: true,
      job_id: jobResult.job_id,
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
