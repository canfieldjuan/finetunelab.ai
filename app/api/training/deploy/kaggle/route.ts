/**
 * Kaggle Deployment API
 * Purpose: Deploy training packages to Kaggle Notebooks with free GPU support
 * Endpoint: POST /api/training/deploy/kaggle
 * Date: 2025-10-31
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { kaggleService } from '@/lib/training/kaggle-service';
import { secretsManager } from '@/lib/secrets/secrets-manager.service';
import { decrypt } from '@/lib/models/encryption';
import type { KaggleDeploymentRequest, KaggleDeploymentResponse } from '@/lib/training/deployment.types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  console.log('[KaggleDeployAPI] Received deployment request');

  try {
    // ========================================================================
    // Step 1: Authenticate user
    // ========================================================================
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[KaggleDeployAPI] No authorization header');
      return NextResponse.json(
        { error: 'Unauthorized - Authorization header required' },
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
      console.error('[KaggleDeployAPI] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - please login' },
        { status: 401 }
      );
    }

    console.log('[KaggleDeployAPI] Authenticated user:', user.email);

    // ========================================================================
    // Step 2: Parse and validate request
    // ========================================================================
    const body: KaggleDeploymentRequest = await req.json();
    const { 
      training_config_id, 
      notebook_title, 
      notebook_slug,
      is_private = true,
      dataset_sources = [],
      enable_gpu = true,
      enable_internet = true,
    } = body;

    if (!training_config_id) {
      return NextResponse.json(
        { error: 'Missing required field: training_config_id' },
        { status: 400 }
      );
    }

    if (!notebook_title) {
      return NextResponse.json(
        { error: 'Missing required field: notebook_title' },
        { status: 400 }
      );
    }

    console.log('[KaggleDeployAPI] Training config:', training_config_id);
    console.log('[KaggleDeployAPI] Notebook title:', notebook_title);

    // ========================================================================
    // Step 3: Retrieve Kaggle credentials from secrets vault
    // ========================================================================
    console.log('[KaggleDeployAPI] Retrieving Kaggle credentials...');
    
    const secret = await secretsManager.getSecret(user.id, 'kaggle', supabase);

    if (!secret) {
      console.error('[KaggleDeployAPI] No Kaggle credentials found');
      return NextResponse.json(
        { 
          error: 'Kaggle credentials not configured',
          details: 'Please add your Kaggle API credentials in Settings > Secrets',
          hint: 'Get your credentials from https://www.kaggle.com/settings/account',
        },
        { status: 400 }
      );
    }

    // Decrypt and parse Kaggle credentials
    const decryptedKey = decrypt(secret.api_key_encrypted);
    let credentials: { username: string; key: string };

    try {
      // Kaggle credentials are stored as JSON: {"username":"...", "key":"..."}
      credentials = JSON.parse(decryptedKey);
      
      if (!credentials.username || !credentials.key) {
        throw new Error('Invalid Kaggle credentials format');
      }
    } catch (error) {
      console.error('[KaggleDeployAPI] Invalid Kaggle credentials:', error);
      return NextResponse.json(
        {
          error: 'Invalid Kaggle credentials',
          details: 'Kaggle credentials must be in JSON format: {"username":"your-username", "key":"your-api-key"}',
        },
        { status: 400 }
      );
    }

    console.log('[KaggleDeployAPI] Kaggle credentials retrieved for:', credentials.username);

    // ========================================================================
    // Step 4: Fetch training configuration
    // ========================================================================
    console.log('[KaggleDeployAPI] Fetching training config:', training_config_id);

    const { data: trainingConfig, error: configError } = await supabase
      .from('training_configs')
      .select('*')
      .eq('id', training_config_id)
      .eq('user_id', user.id)
      .single();

    if (configError || !trainingConfig) {
      console.error('[KaggleDeployAPI] Training config not found:', configError);
      return NextResponse.json(
        { error: 'Training configuration not found' },
        { status: 404 }
      );
    }

    console.log('[KaggleDeployAPI] Training config found:', trainingConfig.name);

    // ========================================================================
    // Step 5: Generate notebook content
    // ========================================================================
    console.log('[KaggleDeployAPI] Generating notebook content...');

    const notebookContent = kaggleService.generateNotebook(
      trainingConfig.model_name || 'unknown-model',
      trainingConfig.dataset_path || '',
      trainingConfig.config || {}
    );

    // ========================================================================
    // Step 6: Create Kaggle notebook
    // ========================================================================
    console.log('[KaggleDeployAPI] Creating Kaggle notebook...');

    const deploymentRequest: KaggleDeploymentRequest = {
      training_config_id,
      notebook_title,
      notebook_slug,
      is_private,
      dataset_sources,
      enable_gpu,
      enable_internet,
    };

    let deploymentResponse: KaggleDeploymentResponse;

    try {
      deploymentResponse = await kaggleService.createNotebook(
        deploymentRequest,
        credentials,
        notebookContent
      );
    } catch (error) {
      console.error('[KaggleDeployAPI] Notebook creation failed:', error);
      return NextResponse.json(
        {
          error: 'Failed to create Kaggle notebook',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }

    console.log('[KaggleDeployAPI] Notebook created:', deploymentResponse.deployment_id);

    // ========================================================================
    // Step 7: Store deployment record in database
    // ========================================================================
    console.log('[KaggleDeployAPI] Storing deployment record...');

    const { data: deploymentRecord, error: insertError } = await supabase
      .from('cloud_deployments')
      .insert({
        user_id: user.id,
        platform: 'kaggle',
        training_config_id,
        deployment_id: deploymentResponse.deployment_id,
        status: deploymentResponse.status,
        url: deploymentResponse.notebook_url,
        config: {
          notebook_title,
          notebook_slug,
          is_private,
          dataset_sources,
          enable_gpu,
          enable_internet,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('[KaggleDeployAPI] Failed to store deployment record:', insertError);
      // Notebook is already created, so we'll return success with warning
      return NextResponse.json({
        ...deploymentResponse,
        warning: 'Deployment created but failed to store record in database',
      });
    }

    console.log('[KaggleDeployAPI] Deployment record stored:', deploymentRecord.id);

    // ========================================================================
    // Step 8: Return success response
    // ========================================================================
    return NextResponse.json({
      ...deploymentResponse,
      record_id: deploymentRecord.id,
      message: 'Kaggle notebook created successfully! It will start running shortly.',
    });

  } catch (error) {
    console.error('[KaggleDeployAPI] Deployment error:', error);

    return NextResponse.json(
      {
        error: 'Deployment failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/training/deploy/kaggle?deployment_id=<id>
 * 
 * Get deployment status
 */
export async function GET(req: NextRequest) {
  console.log('[KaggleDeployAPI] Get deployment status');

  try {
    const deploymentId = req.nextUrl.searchParams.get('deployment_id');

    if (!deploymentId) {
      return NextResponse.json(
        { error: 'Missing required parameter: deployment_id' },
        { status: 400 }
      );
    }

    // Authenticate
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Kaggle credentials
    const secret = await secretsManager.getSecret(user.id, 'kaggle', supabase);

    if (!secret) {
      return NextResponse.json(
        { error: 'Kaggle credentials not found' },
        { status: 400 }
      );
    }

    const decryptedKey = decrypt(secret.api_key_encrypted);
    const credentials = JSON.parse(decryptedKey);

    // Get status from Kaggle
    const status = await kaggleService.getNotebookStatus(deploymentId, credentials);

    // Update database record
    await supabase
      .from('cloud_deployments')
      .update({
        status: status.status,
        error_message: status.error_message,
      })
      .eq('deployment_id', deploymentId)
      .eq('user_id', user.id);

    return NextResponse.json(status);

  } catch (error) {
    console.error('[KaggleDeployAPI] Status check error:', error);

    return NextResponse.json(
      {
        error: 'Failed to get deployment status',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/training/deploy/kaggle?deployment_id=<id>
 * 
 * Cancel running notebook
 */
export async function DELETE(req: NextRequest) {
  console.log('[KaggleDeployAPI] Cancel deployment');

  try {
    const deploymentId = req.nextUrl.searchParams.get('deployment_id');

    if (!deploymentId) {
      return NextResponse.json(
        { error: 'Missing required parameter: deployment_id' },
        { status: 400 }
      );
    }

    // Authenticate
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Kaggle credentials
    const secret = await secretsManager.getSecret(user.id, 'kaggle', supabase);

    if (!secret) {
      return NextResponse.json(
        { error: 'Kaggle credentials not found' },
        { status: 400 }
      );
    }

    const decryptedKey = decrypt(secret.api_key_encrypted);
    const credentials = JSON.parse(decryptedKey);

    // Cancel notebook
    await kaggleService.cancelNotebook(deploymentId, credentials);

    // Update database
    await supabase
      .from('cloud_deployments')
      .update({
        status: 'cancelled',
      })
      .eq('deployment_id', deploymentId)
      .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      message: 'Notebook cancelled successfully',
    });

  } catch (error) {
    console.error('[KaggleDeployAPI] Cancel error:', error);

    return NextResponse.json(
      {
        error: 'Failed to cancel deployment',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
