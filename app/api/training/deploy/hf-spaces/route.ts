/**
 * HuggingFace Spaces Deployment API Routes
 * Purpose: Handle deployment to HuggingFace Spaces with cost tracking
 * Date: 2025-10-31
 * 
 * Endpoints:
 * - POST /api/training/deploy/hf-spaces - Deploy training to HF Space
 * - GET /api/training/deploy/hf-spaces?deployment_id=<space_id> - Get deployment status
 * - DELETE /api/training/deploy/hf-spaces?deployment_id=<space_id> - Stop deployment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hfSpacesService } from '@/lib/training/hf-spaces-service';
import { secretsManager } from '@/lib/secrets/secrets-manager.service';
import { decrypt } from '@/lib/models/encryption';
import type { HFSpacesDeploymentRequest, HFSpaceGPUTier } from '@/lib/training/deployment.types';
import { STATUS } from '@/lib/constants';

export const runtime = 'nodejs';

// ============================================================================
// TYPES
// ============================================================================

interface HFSpacesConfig {
  space_name?: string;
  gpu_tier?: HFSpaceGPUTier;
  visibility?: string;
  budget_limit?: number;
  alert_threshold?: number;
  auto_stop_on_budget?: boolean;
}

// ============================================================================
// POST - Deploy to HuggingFace Spaces
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    console.log('[HF Spaces API] Received deployment request');

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
      console.error('[HF Spaces API] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: HFSpacesDeploymentRequest = await request.json();
    const {
      training_config_id,
      space_name,
      gpu_tier,
      visibility,
      budget_limit,
      alert_threshold,
      auto_stop_on_budget,
    } = body;

    console.log('[HF Spaces API] Request:', {
      training_config_id,
      space_name,
      gpu_tier,
      user_id: user.id,
    });

    // Validate required fields
    if (!training_config_id) {
      return NextResponse.json(
        { error: 'Missing required field: training_config_id' },
        { status: 400 }
      );
    }

    // Retrieve HuggingFace token from secrets vault
    const secret = await secretsManager.getSecret(user.id, 'huggingface', supabase);
    
    if (!secret) {
      console.error('[HF Spaces API] No HuggingFace credentials found');
      return NextResponse.json(
        { error: 'HuggingFace token not configured. Please add your HF token in the Secrets Vault.' },
        { status: 400 }
      );
    }

    // Decrypt HF token
    let hfToken: string;
    try {
      hfToken = decrypt(secret.api_key_encrypted);
    } catch (error) {
      console.error('[HF Spaces API] Failed to decrypt token:', error);
      return NextResponse.json(
        { error: 'Failed to decrypt HuggingFace token' },
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
      console.error('[HF Spaces API] Training config not found:', configError);
      return NextResponse.json(
        { error: 'Training configuration not found' },
        { status: 404 }
      );
    }

    console.log('[HF Spaces API] Retrieved training config:', trainingConfig.name);

    // Generate training files
    const dockerfile = hfSpacesService.generateDockerfile(trainingConfig.model_name);
    const trainScript = hfSpacesService.generateTrainingScript(
      trainingConfig.model_name,
      trainingConfig.dataset_path || '',
      trainingConfig.config || {}
    );
    const requirements = hfSpacesService.generateRequirements();

    // Create Space deployment
    const deployment = await hfSpacesService.createSpace(
      {
        training_config_id,
        space_name,
        gpu_tier,
        visibility,
        budget_limit,
        alert_threshold,
        auto_stop_on_budget,
      },
      hfToken,
      {
        dockerfile,
        trainScript,
        requirements,
      }
    );

    console.log('[HF Spaces API] Space created:', deployment.deployment_id);

    // Store deployment in database
    const { error: insertError } = await supabase
      .from('cloud_deployments')
      .insert({
        user_id: user.id,
        platform: 'huggingface-spaces',
        training_config_id,
        deployment_id: deployment.deployment_id,
        status: deployment.status,
        url: deployment.space_url,
        config: {
          space_name,
          gpu_tier,
          visibility,
          budget_limit,
          alert_threshold,
          auto_stop_on_budget,
        },
        estimated_cost: deployment.cost.estimated_cost,
        cost_per_hour: deployment.cost.cost_per_hour,
        budget_limit,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[HF Spaces API] Failed to store deployment:', insertError);
      // Don't fail the request - Space was created successfully
    }

    console.log('[HF Spaces API] Deployment stored in database');

    return NextResponse.json({
      deployment_id: deployment.deployment_id,
      space_url: deployment.space_url,
      status: deployment.status,
      gpu_tier: deployment.gpu_tier,
      cost: deployment.cost,
      message: 'HuggingFace Space deployment created successfully',
    });

  } catch (error) {
    console.error('[HF Spaces API] Deployment failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create HuggingFace Space deployment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get deployment status with cost tracking
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    console.log('[HF Spaces API] Received status request');

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
      console.error('[HF Spaces API] Authentication failed:', authError);
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

    console.log('[HF Spaces API] Getting status for Space:', deploymentId);

    // Get deployment record for cost tracking
    const { data: deploymentRecord, error: recordError } = await supabase
      .from('cloud_deployments')
      .select('*')
      .eq('deployment_id', deploymentId)
      .eq('user_id', user.id)
      .single();

    if (recordError || !deploymentRecord) {
      return NextResponse.json(
        { error: 'Deployment not found' },
        { status: 404 }
      );
    }

    // Retrieve HuggingFace token
    const secret = await secretsManager.getSecret(user.id, 'huggingface', supabase);
    
    if (!secret) {
      return NextResponse.json(
        { error: 'HuggingFace token not configured' },
        { status: 400 }
      );
    }

    const hfToken = decrypt(secret.api_key_encrypted);

    // Get Space status
    const status = await hfSpacesService.getSpaceStatus(deploymentId, hfToken);

    console.log('[HF Spaces API] Current status:', status.status);

    // Calculate actual cost if training started
    let actualCost = deploymentRecord.actual_cost || 0;
    const deploymentConfig = deploymentRecord.config as HFSpacesConfig;
    
    if (deploymentRecord.started_at) {
      const startTime = new Date(deploymentRecord.started_at);
      const endTime = deploymentRecord.completed_at ? new Date(deploymentRecord.completed_at) : undefined;
      const gpuTier = deploymentConfig?.gpu_tier || 't4-small';
      
      actualCost = hfSpacesService.calculateActualCost(
        gpuTier,
        startTime,
        endTime
      );
    }

    // Check budget thresholds
    const budgetCheck = hfSpacesService.checkBudgetThreshold(
      actualCost,
      deploymentRecord.budget_limit,
      deploymentConfig?.alert_threshold || parseInt(process.env.HF_SPACES_DEFAULT_ALERT_THRESHOLD || '80', 10)
    );

    // Auto-stop if budget exceeded and auto_stop enabled
    if (budgetCheck.isOverBudget && deploymentConfig?.auto_stop_on_budget) {
      console.log('[HF Spaces API] Budget exceeded, auto-stopping Space...');
      await hfSpacesService.deleteSpace(deploymentId, hfToken);
      
      await supabase
        .from('cloud_deployments')
        .update({
          status: STATUS.STOPPED,
          actual_cost: actualCost,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error_message: 'Auto-stopped: Budget limit exceeded',
        })
        .eq('deployment_id', deploymentId)
        .eq('user_id', user.id);

      return NextResponse.json({
        deployment_id: deploymentId,
        status: STATUS.STOPPED,
        space_url: status.space_url,
        cost: {
          ...status.cost,
          actual_cost: actualCost,
        },
        budget_status: budgetCheck,
        message: 'Deployment auto-stopped due to budget limit',
      });
    }

    // Update database record
    const updateData: {
      status: string;
      actual_cost: number;
      updated_at: string;
      started_at?: string;
      completed_at?: string;
    } = {
      status: status.status,
      actual_cost: actualCost,
      updated_at: new Date().toISOString(),
    };

    // Set started_at if training just started
    if (status.status === STATUS.RUNNING && !deploymentRecord.started_at) {
      updateData.started_at = new Date().toISOString();
    }

    // Set completed_at if training finished
    if ([STATUS.COMPLETED, STATUS.FAILED, STATUS.STOPPED].includes(status.status as typeof STATUS.COMPLETED | typeof STATUS.FAILED | typeof STATUS.STOPPED) && !deploymentRecord.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('cloud_deployments')
      .update(updateData)
      .eq('deployment_id', deploymentId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[HF Spaces API] Failed to update status:', updateError);
    }

    return NextResponse.json({
      deployment_id: deploymentId,
      status: status.status,
      space_url: status.space_url,
      cost: {
        ...status.cost,
        actual_cost: actualCost,
        budget_limit: deploymentRecord.budget_limit,
      },
      budget_status: budgetCheck,
      metrics: status.metrics,
    });

  } catch (error) {
    console.error('[HF Spaces API] Status check failed:', error);
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
    console.log('[HF Spaces API] Received stop request');

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
      console.error('[HF Spaces API] Authentication failed:', authError);
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

    console.log('[HF Spaces API] Stopping Space:', deploymentId);

    // Get deployment record for final cost calculation
    const { data: deploymentRecord } = await supabase
      .from('cloud_deployments')
      .select('*')
      .eq('deployment_id', deploymentId)
      .eq('user_id', user.id)
      .single();

    // Retrieve HuggingFace token
    const secret = await secretsManager.getSecret(user.id, 'huggingface', supabase);
    
    if (!secret) {
      return NextResponse.json(
        { error: 'HuggingFace token not configured' },
        { status: 400 }
      );
    }

    const hfToken = decrypt(secret.api_key_encrypted);

    // Delete Space
    await hfSpacesService.deleteSpace(deploymentId, hfToken);

    console.log('[HF Spaces API] Space deleted');

    // Calculate final cost
    let finalCost = 0;
    if (deploymentRecord?.started_at) {
      const startTime = new Date(deploymentRecord.started_at);
      const finalConfig = deploymentRecord.config as HFSpacesConfig;
      const gpuTier = finalConfig?.gpu_tier || 't4-small';
      
      finalCost = hfSpacesService.calculateActualCost(gpuTier, startTime);
    }

    // Update database record
    const { error: updateError } = await supabase
      .from('cloud_deployments')
      .update({
        status: STATUS.STOPPED,
        actual_cost: finalCost,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('deployment_id', deploymentId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[HF Spaces API] Failed to update status:', updateError);
    }

    return NextResponse.json({
      deployment_id: deploymentId,
      status: STATUS.STOPPED,
      final_cost: finalCost,
      message: 'HuggingFace Space deployment stopped successfully',
    });

  } catch (error) {
    console.error('[HF Spaces API] Stop failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to stop deployment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
