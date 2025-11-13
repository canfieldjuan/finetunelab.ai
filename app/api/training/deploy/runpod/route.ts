/**
 * RunPod Deployment API Routes
 * Purpose: Handle deployment to RunPod serverless GPU pods
 * Date: 2025-10-31
 * 
 * Endpoints:
 * - POST /api/training/deploy/runpod - Deploy training to RunPod
 * - GET /api/training/deploy/runpod?deployment_id=<pod_id> - Get deployment status
 * - DELETE /api/training/deploy/runpod?deployment_id=<pod_id> - Stop deployment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runPodService } from '@/lib/training/runpod-service';
import { secretsManager } from '@/lib/secrets/secrets-manager.service';
import { decrypt } from '@/lib/models/encryption';
import type { RunPodDeploymentRequest } from '@/lib/training/deployment.types';

export const runtime = 'nodejs';

// ============================================================================
// POST - Deploy to RunPod
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    console.log('[RunPod API] Received deployment request');

    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[RunPod API] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: RunPodDeploymentRequest = await request.json();
    const {
      training_config_id,
      gpu_type,
      gpu_count,
      docker_image,
      volume_size_gb,
      environment_variables,
      budget_limit,
    } = body;

    console.log('[RunPod API] Request:', {
      training_config_id,
      gpu_type,
      gpu_count,
      user_id: user.id,
    });

    // Validate required fields
    if (!training_config_id) {
      return NextResponse.json(
        { error: 'Missing required field: training_config_id' },
        { status: 400 }
      );
    }

    // Retrieve RunPod API key from secrets vault
    const secret = await secretsManager.getSecret(user.id, 'runpod', supabase);
    
    if (!secret) {
      console.error('[RunPod API] No RunPod credentials found');
      return NextResponse.json(
        { error: 'RunPod API key not configured. Please add your RunPod credentials in the Secrets Vault.' },
        { status: 400 }
      );
    }

    // Decrypt API key
    let runpodApiKey: string;
    try {
      runpodApiKey = decrypt(secret.api_key_encrypted);
    } catch (error) {
      console.error('[RunPod API] Failed to decrypt API key:', error);
      return NextResponse.json(
        { error: 'Failed to decrypt RunPod API key' },
        { status: 500 }
      );
    }

    // Fetch training configuration
    const { data: trainingConfig, error: configError } = await supabase
      .from('training_configs')
      .select('*')
      .eq('id', training_config_id)
      .eq('user_id', user.id)
      .single();

    if (configError || !trainingConfig) {
      console.error('[RunPod API] Training config not found:', configError);
      return NextResponse.json(
        { error: 'Training configuration not found' },
        { status: 404 }
      );
    }

    console.log('[RunPod API] Retrieved training config:', trainingConfig.name);

    // Generate training script
    const trainingScript = runPodService.generateTrainingScript(
      trainingConfig.model_name,
      trainingConfig.dataset_path || '',
      trainingConfig.config || {}
    );

    // Create pod deployment
    const deployment = await runPodService.createPod(
      {
        training_config_id,
        gpu_type,
        gpu_count,
        docker_image,
        volume_size_gb,
        environment_variables,
        budget_limit,
      },
      runpodApiKey,
      trainingScript
    );

    console.log('[RunPod API] Pod created:', deployment.pod_id);

    // Store deployment in database
    const { error: insertError } = await supabase
      .from('cloud_deployments')
      .insert({
        user_id: user.id,
        platform: 'runpod',
        training_config_id,
        deployment_id: deployment.pod_id,
        status: deployment.status,
        url: deployment.pod_url,
        config: {
          gpu_type,
          gpu_count,
          docker_image,
          volume_size_gb,
          environment_variables,
        },
        estimated_cost: deployment.cost.estimated_cost,
        cost_per_hour: deployment.cost.cost_per_hour,
        budget_limit,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[RunPod API] Failed to store deployment:', insertError);
      // Don't fail the request - pod was created successfully
    }

    console.log('[RunPod API] Deployment stored in database');

    return NextResponse.json({
      deployment_id: deployment.pod_id,
      pod_id: deployment.pod_id,
      pod_url: deployment.pod_url,
      status: deployment.status,
      gpu_type: deployment.gpu_type,
      gpu_count: deployment.gpu_count,
      cost: deployment.cost,
      message: 'RunPod deployment created successfully',
    });

  } catch (error) {
    console.error('[RunPod API] Deployment failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create RunPod deployment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get deployment status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    console.log('[RunPod API] Received status request');

    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[RunPod API] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get deployment ID from query
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deployment_id');

    if (!deploymentId) {
      return NextResponse.json(
        { error: 'Missing deployment_id parameter' },
        { status: 400 }
      );
    }

    console.log('[RunPod API] Getting status for pod:', deploymentId);

    // Retrieve RunPod API key
    const secret = await secretsManager.getSecret(user.id, 'runpod', supabase);
    
    if (!secret) {
      return NextResponse.json(
        { error: 'RunPod API key not configured' },
        { status: 400 }
      );
    }

    const runpodApiKey = decrypt(secret.api_key_encrypted);

    // Get pod status
    const status = await runPodService.getPodStatus(deploymentId, runpodApiKey);

    console.log('[RunPod API] Current status:', status.status);

    // Update database record
    const { error: updateError } = await supabase
      .from('cloud_deployments')
      .update({
        status: status.status,
        actual_cost: status.cost.actual_cost,
        updated_at: new Date().toISOString(),
      })
      .eq('deployment_id', deploymentId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[RunPod API] Failed to update status:', updateError);
    }

    return NextResponse.json({
      deployment_id: status.pod_id,
      status: status.status,
      pod_url: status.pod_url,
      cost: status.cost,
      metrics: status.metrics,
    });

  } catch (error) {
    console.error('[RunPod API] Status check failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get deployment status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Stop deployment
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    console.log('[RunPod API] Received stop request');

    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[RunPod API] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get deployment ID from query
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deployment_id');

    if (!deploymentId) {
      return NextResponse.json(
        { error: 'Missing deployment_id parameter' },
        { status: 400 }
      );
    }

    console.log('[RunPod API] Stopping pod:', deploymentId);

    // Retrieve RunPod API key
    const secret = await secretsManager.getSecret(user.id, 'runpod', supabase);
    
    if (!secret) {
      return NextResponse.json(
        { error: 'RunPod API key not configured' },
        { status: 400 }
      );
    }

    const runpodApiKey = decrypt(secret.api_key_encrypted);

    // Stop pod
    await runPodService.stopPod(deploymentId, runpodApiKey);

    console.log('[RunPod API] Pod stopped');

    // Update database record
    const { error: updateError } = await supabase
      .from('cloud_deployments')
      .update({
        status: 'stopped',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('deployment_id', deploymentId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[RunPod API] Failed to update status:', updateError);
    }

    return NextResponse.json({
      deployment_id: deploymentId,
      status: 'stopped',
      message: 'RunPod deployment stopped successfully',
    });

  } catch (error) {
    console.error('[RunPod API] Stop failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to stop deployment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
