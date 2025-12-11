/**
 * Google Colab Deployment API
 * Purpose: Deploy training packages to Google Colab with OAuth/API key support
 * Endpoint: POST /api/training/deploy/google-colab
 * Date: 2025-11-12
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { googleColabService } from '@/lib/training/google-colab-service';
import { secretsManager } from '@/lib/secrets/secrets-manager.service';
import { decrypt } from '@/lib/models/encryption';
import type { ColabDeploymentRequest, ColabDeploymentResponse } from '@/lib/training/deployment.types';

export const runtime = 'nodejs';

/**
 * POST /api/training/deploy/google-colab
 *
 * Create a new Google Colab notebook deployment
 */
export async function POST(req: NextRequest) {
  console.log('[GoogleColabDeployAPI] Received deployment request');

  try {
    // ========================================================================
    // Step 1: Authenticate user
    // ========================================================================
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[GoogleColabDeployAPI] No authorization header');
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
      console.error('[GoogleColabDeployAPI] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - please login' },
        { status: 401 }
      );
    }

    console.log('[GoogleColabDeployAPI] Authenticated user:', user.email);

    // ========================================================================
    // Step 2: Parse and validate request
    // ========================================================================
    const body: ColabDeploymentRequest = await req.json();
    const {
      training_config_id,
      notebook_name,
      gpu_tier = 't4',
      runtime_type = 'standard',
      enable_tpu = false,
      budget_limit,
      auto_stop_on_budget = true,
    } = body;

    if (!training_config_id) {
      return NextResponse.json(
        { error: 'Missing required field: training_config_id' },
        { status: 400 }
      );
    }

    if (!notebook_name) {
      return NextResponse.json(
        { error: 'Missing required field: notebook_name' },
        { status: 400 }
      );
    }

    console.log('[GoogleColabDeployAPI] Training config:', training_config_id);
    console.log('[GoogleColabDeployAPI] Notebook name:', notebook_name);
    console.log('[GoogleColabDeployAPI] GPU tier:', gpu_tier);

    // ========================================================================
    // Step 3: Get Google credentials - DUAL AUTH LOGIC
    // ========================================================================
    console.log('[GoogleColabDeployAPI] Retrieving Google credentials...');

    let credentials: { type: 'oauth' | 'service_account'; token?: string; serviceAccount?: string } | null = null;

    // Priority 1: Try OAuth token from session
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.provider_token) {
      // User is logged in with Google OAuth
      console.log('[GoogleColabDeployAPI] Using OAuth token from session');
      credentials = {
        type: 'oauth',
        token: session.provider_token,
      };
    }

    // Priority 2: Fall back to API key from secrets vault
    if (!credentials) {
      console.log('[GoogleColabDeployAPI] No OAuth token, checking secrets vault...');
      const secret = await secretsManager.getSecret(user.id, 'google-colab', supabase);

      if (secret) {
        console.log('[GoogleColabDeployAPI] Using service account from secrets vault');
        const decryptedKey = decrypt(secret.api_key_encrypted);

        credentials = {
          type: 'service_account',
          serviceAccount: decryptedKey,
        };
      }
    }

    // Error: No credentials available
    if (!credentials) {
      console.error('[GoogleColabDeployAPI] No Google credentials found');
      return NextResponse.json(
        {
          error: 'No Google credentials found',
          details: 'Please login with Google (preferred) or add a Google Cloud service account key in Settings > Secrets',
          hint: 'OAuth: Login with Google | API Key: Add service account JSON in Secrets Vault',
        },
        { status: 401 }
      );
    }

    console.log('[GoogleColabDeployAPI] Using credential type:', credentials.type);

    // ========================================================================
    // Step 4: Fetch training configuration
    // ========================================================================
    console.log('[GoogleColabDeployAPI] Fetching training config:', training_config_id);

    const { data: trainingConfig, error: configError } = await supabase
      .from('training_configs')
      .select('*')
      .eq('id', training_config_id)
      .eq('user_id', user.id)
      .single();

    if (configError || !trainingConfig) {
      console.error('[GoogleColabDeployAPI] Training config not found:', configError);
      return NextResponse.json(
        { error: 'Training configuration not found' },
        { status: 404 }
      );
    }

    console.log('[GoogleColabDeployAPI] Training config found:', trainingConfig.name);

    // ========================================================================
    // Step 5: Generate notebook content
    // ========================================================================
    console.log('[GoogleColabDeployAPI] Generating notebook content...');

    const notebookContent = googleColabService.generateNotebook(
      trainingConfig.model_name || 'unknown-model',
      trainingConfig.dataset_path || '',
      trainingConfig.config || {},
      gpu_tier
    );

    // ========================================================================
    // Step 6: Create Google Colab notebook
    // ========================================================================
    console.log('[GoogleColabDeployAPI] Creating Google Colab notebook...');

    const deploymentRequest: ColabDeploymentRequest = {
      training_config_id,
      notebook_name,
      gpu_tier,
      runtime_type,
      enable_tpu,
      budget_limit,
      auto_stop_on_budget,
    };

    let deploymentResponse: ColabDeploymentResponse;

    try {
      deploymentResponse = await googleColabService.createNotebook(
        deploymentRequest,
        credentials,
        notebookContent
      );
    } catch (error) {
      console.error('[GoogleColabDeployAPI] Notebook creation failed:', error);
      return NextResponse.json(
        {
          error: 'Failed to create Google Colab notebook',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }

    console.log('[GoogleColabDeployAPI] Notebook created:', deploymentResponse.deployment_id);

    // ========================================================================
    // Step 7: Store deployment record in database
    // ========================================================================
    console.log('[GoogleColabDeployAPI] Storing deployment record...');

    const { data: deploymentRecord, error: insertError } = await supabase
      .from('cloud_deployments')
      .insert({
        user_id: user.id,
        platform: 'google-colab',
        training_config_id,
        deployment_id: deploymentResponse.deployment_id,
        status: deploymentResponse.status,
        url: deploymentResponse.notebook_url,
        config: {
          notebook_name,
          gpu_tier,
          runtime_type,
          enable_tpu,
          budget_limit,
          auto_stop_on_budget,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('[GoogleColabDeployAPI] Failed to store deployment record:', insertError);
      // Notebook is already created, so we'll return success with warning
      return NextResponse.json({
        ...deploymentResponse,
        warning: 'Deployment created but failed to store record in database',
      });
    }

    console.log('[GoogleColabDeployAPI] Deployment record stored:', deploymentRecord.id);

    // ========================================================================
    // Step 8: Return success response
    // ========================================================================
    return NextResponse.json({
      ...deploymentResponse,
      record_id: deploymentRecord.id,
      message: 'Google Colab notebook created successfully! Open the notebook to start training.',
    });

  } catch (error) {
    console.error('[GoogleColabDeployAPI] Deployment error:', error);

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
 * GET /api/training/deploy/google-colab?deployment_id=<id>
 *
 * Get deployment status
 */
export async function GET(req: NextRequest) {
  console.log('[GoogleColabDeployAPI] Get deployment status');

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

    // Get deployment record from database
    const { data: deployment, error: dbError } = await supabase
      .from('cloud_deployments')
      .select('*')
      .eq('deployment_id', deploymentId)
      .eq('user_id', user.id)
      .eq('platform', 'google-colab')
      .single();

    if (dbError || !deployment) {
      return NextResponse.json(
        { error: 'Deployment not found' },
        { status: 404 }
      );
    }

    // Get credentials for status check
    let credentials: { type: 'oauth' | 'service_account'; token?: string; serviceAccount?: string } | null = null;

    const { data: { session } } = await supabase.auth.getSession();

    if (session?.provider_token) {
      credentials = {
        type: 'oauth',
        token: session.provider_token,
      };
    } else {
      const secret = await secretsManager.getSecret(user.id, 'google-colab', supabase);
      if (secret) {
        credentials = {
          type: 'service_account',
          serviceAccount: decrypt(secret.api_key_encrypted),
        };
      }
    }

    if (!credentials) {
      return NextResponse.json(
        { error: 'No Google credentials available for status check' },
        { status: 401 }
      );
    }

    // Get status from Google Colab API
    const status = await googleColabService.getNotebookStatus(
      deploymentId,
      credentials
    );

    // Update database with latest status
    await supabase
      .from('cloud_deployments')
      .update({ status: status.status })
      .eq('id', deployment.id);

    return NextResponse.json(status);

  } catch (error) {
    console.error('[GoogleColabDeployAPI] Get status error:', error);
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
 * DELETE /api/training/deploy/google-colab?deployment_id=<id>
 *
 * Stop/delete a deployment
 */
export async function DELETE(req: NextRequest) {
  console.log('[GoogleColabDeployAPI] Delete deployment');

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

    // Get deployment record
    const { data: deployment, error: dbError } = await supabase
      .from('cloud_deployments')
      .select('*')
      .eq('deployment_id', deploymentId)
      .eq('user_id', user.id)
      .eq('platform', 'google-colab')
      .single();

    if (dbError || !deployment) {
      return NextResponse.json(
        { error: 'Deployment not found' },
        { status: 404 }
      );
    }

    // Get credentials
    let credentials: { type: 'oauth' | 'service_account'; token?: string; serviceAccount?: string } | null = null;

    const { data: { session } } = await supabase.auth.getSession();

    if (session?.provider_token) {
      credentials = {
        type: 'oauth',
        token: session.provider_token,
      };
    } else {
      const secret = await secretsManager.getSecret(user.id, 'google-colab', supabase);
      if (secret) {
        credentials = {
          type: 'service_account',
          serviceAccount: decrypt(secret.api_key_encrypted),
        };
      }
    }

    if (!credentials) {
      return NextResponse.json(
        { error: 'No Google credentials available' },
        { status: 401 }
      );
    }

    // Stop notebook (deletes the file)
    await googleColabService.stopNotebook(deploymentId, credentials);

    // Update database status
    await supabase
      .from('cloud_deployments')
      .update({ status: 'stopped' })
      .eq('id', deployment.id);

    return NextResponse.json({
      success: true,
      message: 'Notebook stopped and deleted successfully',
    });

  } catch (error) {
    console.error('[GoogleColabDeployAPI] Delete error:', error);
    return NextResponse.json(
      {
        error: 'Failed to stop deployment',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
