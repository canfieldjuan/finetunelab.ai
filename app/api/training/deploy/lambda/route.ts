/**
 * Lambda Labs Deployment API Route
 * Purpose: Deploy training jobs to Lambda Labs GPU instances
 * Date: 2025-11-25
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LambdaLabsService } from '@/lib/training/lambda-service';
import { secretsManager } from '@/lib/secrets/secrets-manager.service';
import { decrypt } from '@/lib/models/encryption';
import type { LambdaDeploymentRequest } from '@/lib/training/deployment.types';
import { generateLocalPackage } from '@/lib/training/local-package-generator';
import { createZipFromDirectory } from '@/lib/training/zip-generator';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { tmpdir } from 'os';

export const runtime = 'nodejs';

const lambdaService = new LambdaLabsService();

// ============================================================================
// POST - Deploy to Lambda Labs
// ============================================================================

export async function POST(request: NextRequest) {
  let jobId: string | undefined;
  let supabase: SupabaseClient | undefined;
  let instanceId: string | undefined;
  let instance_type: string | undefined;
  let region: string | undefined;

  try {
    console.log('[Lambda API] Received deployment request');

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
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Lambda API] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: LambdaDeploymentRequest = await request.json();
    const {
      training_config_id,
      budget_limit,
    } = body;

    // Assign to outer scope variables for error handling
    instance_type = body.instance_type;
    region = body.region;

    console.log('[Lambda API] Request:', {
      training_config_id,
      instance_type,
      region,
      user_id: user.id,
    });

    // Validate required fields
    if (!training_config_id) {
      return NextResponse.json(
        { error: 'Missing required field: training_config_id' },
        { status: 400 }
      );
    }

    if (!instance_type) {
      return NextResponse.json(
        { error: 'Missing required field: instance_type' },
        { status: 400 }
      );
    }

    if (!region) {
      return NextResponse.json(
        { error: 'Missing required field: region' },
        { status: 400 }
      );
    }

    // Retrieve Lambda Labs API key from secrets vault
    const secret = await secretsManager.getSecret(user.id, 'lambda', supabase);
    
    if (!secret) {
      console.error('[Lambda API] No Lambda Labs credentials found');
      return NextResponse.json(
        { error: 'Lambda Labs API key not configured. Please add your Lambda Labs credentials in the Secrets Vault.' },
        { status: 400 }
      );
    }

    // Decrypt API key
    let lambdaApiKey: string;
    try {
      lambdaApiKey = decrypt(secret.api_key_encrypted);
    } catch (error) {
      console.error('[Lambda API] Failed to decrypt API key:', error);
      return NextResponse.json(
        { error: 'Failed to decrypt Lambda Labs API key' },
        { status: 500 }
      );
    }

    // Retrieve Lambda SSH key name from metadata
    const sshKeyName = secret.metadata?.lambda?.ssh_key_name;

    if (!sshKeyName) {
      console.error('[Lambda API] No SSH key name configured in secrets vault');
      return NextResponse.json(
        { 
          error: 'Lambda Labs SSH key name not configured. Please add your SSH key name in the Secrets Vault (Settings → Secrets → Lambda Labs).' 
        },
        { status: 400 }
      );
    }

    console.log('[Lambda API] ✓ Retrieved SSH key name from secrets vault:', sshKeyName);

    // Retrieve HuggingFace credentials for model upload (optional)
    let hfToken: string | undefined;
    let hfRepoName: string | undefined;

    const hfSecret = await secretsManager.getSecret(user.id, 'huggingface', supabase);
    if (hfSecret) {
      try {
        hfToken = decrypt(hfSecret.api_key_encrypted);

        // Debug: Log the entire metadata structure
        console.log('[Lambda API] HuggingFace metadata:', JSON.stringify(hfSecret.metadata));

        // Try multiple possible paths for username
        let hfUsername =
          hfSecret.metadata?.huggingface?.username ||  // Expected path
          hfSecret.metadata?.username ||                // Alternative path
          (hfSecret.metadata as any)?.hf_username;      // Another alternative

        console.log('[Lambda API] Extracted username:', hfUsername);

        // If username not in metadata, try to fetch it from HuggingFace API
        if (hfToken && !hfUsername) {
          console.log('[Lambda API] Fetching HuggingFace username from API...');
          try {
            const hfResponse = await fetch('https://huggingface.co/api/whoami', {
              headers: { 'Authorization': `Bearer ${hfToken}` }
            });
            if (hfResponse.ok) {
              const hfData = await hfResponse.json();
              hfUsername = hfData.name;
              console.log('[Lambda API] ✓ Retrieved HuggingFace username from API:', hfUsername);
            } else {
              console.warn('[Lambda API] Failed to fetch HF username:', hfResponse.status);
            }
          } catch (apiError) {
            console.warn('[Lambda API] Error fetching HF username:', apiError);
          }
        }

        if (hfToken && hfUsername) {
          // Auto-generate repo name from HF username + config name
          // Format: username/config-name (sanitized)
          const sanitizedConfigName = training_config_id.slice(0, 8); // Use first 8 chars of ID as fallback
          hfRepoName = `${hfUsername}/finetune-${sanitizedConfigName}`;
          console.log('[Lambda API] ✓ HuggingFace upload enabled:', hfRepoName);
        } else {
          console.log('[Lambda API] ℹ HuggingFace credentials incomplete (missing username)');
        }
      } catch (error) {
        console.warn('[Lambda API] Failed to decrypt HuggingFace token:', error);
      }
    } else {
      console.log('[Lambda API] ℹ No HuggingFace credentials - model upload disabled');
    }

    // Fetch training configuration with attached datasets
    const { data: trainingConfig, error: configError } = await supabase
      .from('training_configs')
      .select(`
        *,
        datasets:training_config_datasets(
          dataset:training_datasets(*)
        )
      `)
      .eq('id', training_config_id)
      .eq('user_id', user.id)
      .single();

    if (configError || !trainingConfig) {
      console.error('[Lambda API] Training config not found:', configError);
      return NextResponse.json(
        { error: 'Training configuration not found' },
        { status: 404 }
      );
    }

    console.log('[Lambda API] Retrieved training config:', trainingConfig.name);

    // Extract dataset from junction table
    const attachedDatasets = trainingConfig.datasets || [];
    const dataset = attachedDatasets[0]?.dataset;
    const datasetStoragePath = dataset?.storage_path;

    console.log('[Lambda API] Attached datasets count:', attachedDatasets.length);
    if (dataset) {
      console.log('[Lambda API] Using dataset:', dataset.name, 'at', datasetStoragePath);
    }

    // Generate temporary download URL for dataset
    let datasetDownloadUrl: string;

    if (datasetStoragePath) {
      console.log('[Lambda API] Generating download URL for dataset:', datasetStoragePath);

      try {
        const { datasetUrlService } = await import('@/lib/training/dataset-url-service');
        const urlData = await datasetUrlService.generateDownloadUrl(
          datasetStoragePath,
          user.id,
          supabase,
          2,
          dataset.storage_provider || 'supabase'
        );

        datasetDownloadUrl = urlData.url;
        console.log('[Lambda API] Dataset download URL generated:', urlData.token.substring(0, 10));
      } catch (error) {
        console.error('[Lambda API] Failed to generate dataset URL:', error);
        return NextResponse.json(
          {
            error: 'Failed to prepare dataset for download',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    } else {
      console.error('[Lambda API] No dataset attached to this training configuration');
      return NextResponse.json(
        { error: 'Please attach a dataset to this training configuration before deploying' },
        { status: 400 }
      );
    }

    // Create training job record
    jobId = crypto.randomUUID();
    const jobToken = crypto.randomBytes(32).toString('base64url');

    const modelName = trainingConfig.config_json?.model?.name ||
                      trainingConfig.model_name ||
                      'Qwen/Qwen2.5-0.5B-Instruct';

    console.log('[Lambda API] Using model:', modelName);

    const { error: jobError } = await supabase
      .from('local_training_jobs')
      .insert({
        id: jobId,
        user_id: user.id,
        model_name: modelName,
        dataset_path: datasetStoragePath,
        status: 'pending',
        job_token: jobToken,
        config: trainingConfig.config_json,
        started_at: new Date().toISOString()
      });

    if (jobError) {
      console.error('[Lambda API] Failed to create job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create training job' },
        { status: 500 }
      );
    }

    console.log('[Lambda API] Created job:', jobId);

    // Generate training package with standalone_trainer.py and all dependencies
    console.log('[Lambda API] Generating training package...');
    const tmpDir = tmpdir();
    const datasetTempDir = path.join(tmpDir, 'finetune-lab-datasets', training_config_id);
    const datasetPaths: string[] = [];

    // Download dataset to temp directory for package inclusion
    if (dataset && datasetStoragePath) {
      console.log('[Lambda API] Downloading dataset for package:', datasetStoragePath);
      await fs.mkdir(datasetTempDir, { recursive: true });

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('training-datasets')
        .download(datasetStoragePath);

      if (downloadError || !fileData) {
        console.error('[Lambda API] Failed to download dataset for package:', downloadError);
        return NextResponse.json(
          { error: 'Failed to prepare dataset for training package' },
          { status: 500 }
        );
      }

      const tempFilePath = path.join(datasetTempDir, 'train_dataset.jsonl');
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(tempFilePath, buffer);
      console.log('[Lambda API] Dataset saved to:', tempFilePath);
      datasetPaths.push(tempFilePath);
    }

    // Generate training package
    const packageOutputDir = path.join(tmpDir, 'finetune-lab-lambda-packages');
    const packageResult = await generateLocalPackage({
      configId: training_config_id,
      configName: trainingConfig.name,
      configJson: trainingConfig.config_json,
      datasetPaths,
      outputDir: packageOutputDir,
      normalizeForBackend: true,
    });

    if (!packageResult.success || !packageResult.packagePath) {
      console.error('[Lambda API] Package generation failed:', packageResult.error);
      return NextResponse.json(
        { error: 'Failed to generate training package' },
        { status: 500 }
      );
    }

    console.log('[Lambda API] Package generated:', packageResult.packagePath);

    // Create zip from package
    const zipFileName = `lambda-training-${jobId}.zip`;
    const zipDir = path.join(tmpDir, 'finetune-lab-lambda-zips');
    const zipPath = path.join(zipDir, zipFileName);

    await fs.mkdir(zipDir, { recursive: true });

    const zipResult = await createZipFromDirectory({
      sourceDir: packageResult.packagePath,
      outputPath: zipPath,
      compressionLevel: parseInt(process.env.TRAINING_PACKAGE_COMPRESSION_LEVEL || '6', 10)
    });

    if (!zipResult.success || !zipResult.zipPath) {
      console.error('[Lambda API] Zip creation failed:', zipResult.error);
      return NextResponse.json(
        { error: 'Failed to create training package zip' },
        { status: 500 }
      );
    }

    console.log('[Lambda API] Zip created:', zipResult.zipPath, 'size:', zipResult.size);

    // Upload zip to Supabase Storage (temporary location)
    // Use the same path pattern as datasets: {user_id}/private/{filename}
    console.log('[Lambda API] Uploading training package to Supabase Storage...');
    const zipBuffer = await fs.readFile(zipResult.zipPath);
    const storagePath = `${user.id}/private/${zipFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('training-datasets')  // Reuse existing bucket
      .upload(storagePath, zipBuffer, {
        contentType: 'application/zip',
        upsert: true,
      });

    if (uploadError) {
      console.error('[Lambda API] Failed to upload package:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload training package' },
        { status: 500 }
      );
    }

    console.log('[Lambda API] Package uploaded to:', storagePath);

    // Generate download URL for package (2-hour expiry)
    let packageDownloadUrl: string;
    try {
      const { datasetUrlService } = await import('@/lib/training/dataset-url-service');
      const urlData = await datasetUrlService.generateDownloadUrl(
        storagePath,
        user.id,
        supabase,
        2  // 2-hour expiry
      );
      packageDownloadUrl = urlData.url;
      console.log('[Lambda API] Package download URL generated');
    } catch (error) {
      console.error('[Lambda API] Failed to generate package URL:', error);
      return NextResponse.json(
        { error: 'Failed to generate package download URL' },
        { status: 500 }
      );
    }

    // Cleanup local temp files
    try {
      await fs.rm(packageResult.packagePath, { recursive: true, force: true });
      await fs.rm(zipResult.zipPath, { force: true });
      if (datasetPaths.length > 0) {
        await fs.rm(datasetTempDir, { recursive: true, force: true });
      }
      console.log('[Lambda API] Cleaned up temporary files');
    } catch (cleanupErr) {
      console.warn('[Lambda API] Failed to cleanup temp files:', cleanupErr);
    }

    // Build training script for cloud-init
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const metricsUrl = `${appUrl}/api/training/jobs/${jobId}/metrics`;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    const trainingScript = generateLambdaTrainingScript(
      packageDownloadUrl,
      jobId,
      jobToken,
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceKey,
      metricsUrl,
      user.id,
      hfToken,
      hfRepoName
    );

    console.log('[Lambda API] Generated cloud-init script, length:', trainingScript.length);

    // Check GPU capacity before launching
    console.log('[Lambda API] Checking GPU capacity...');
    const capacityCheck = await lambdaService.checkCapacity(
      instance_type!,
      region!,
      lambdaApiKey
    );

    if (!capacityCheck.available) {
      console.log('[Lambda API] GPU unavailable:', { instance_type, region });
      console.log('[Lambda API] Alternatives:', capacityCheck.alternatives);

      const gpuName = instance_type!.replace('gpu_1x_', '').toUpperCase();

      return NextResponse.json(
        {
          error: 'GPU Unavailable',
          error_type: 'capacity',
          message: `The ${gpuName} GPU is currently unavailable in ${region}.`,
          details: 'Lambda Labs reports no capacity for this GPU in the selected region.',
          suggestions: [
            capacityCheck.alternatives.gpus.length > 0
              ? `Try alternative GPUs: ${capacityCheck.alternatives.gpus.slice(0, 3).map(g => g.replace('gpu_1x_', '').toUpperCase()).join(', ')}`
              : 'Try a different GPU type (A10 or RTX 6000 are usually available)',
            capacityCheck.alternatives.regions.length > 0
              ? `Try regions: ${capacityCheck.alternatives.regions.slice(0, 3).join(', ')}`
              : 'Select a different region',
            'Wait a few minutes and try again - availability changes frequently'
          ],
          alternatives: {
            gpus: capacityCheck.alternatives.gpus,
            regions: capacityCheck.alternatives.regions
          }
        },
        { status: 503 } // 503 = Service Unavailable
      );
    }

    console.log('[Lambda API] ✓ Capacity confirmed, launching instance...');

    // Launch Lambda Labs instance with cloud-init script
    // Script will run automatically on boot - no SSH required
    const deployment = await lambdaService.createInstance(
      {
        training_config_id,
        instance_type: instance_type! as any,
        region: region!,
        ssh_key_name: sshKeyName,  // From secrets vault
        budget_limit,
      },
      lambdaApiKey,
      trainingScript  // Pass training script as cloud-init user_data
    );

    instanceId = deployment.instance_id;
    console.log('[Lambda API] Instance launched with cloud-init script:', instanceId);

    // Store deployment in database
    const { error: deploymentError } = await supabase
      .from('cloud_deployments')
      .insert({
        user_id: user.id,
        platform: 'lambda',
        training_config_id,
        deployment_id: instanceId,
        status: 'running',
        url: `https://cloud.lambdalabs.com/instances/${instanceId}`,
        config: {
          instance_type,
          region,
          budget_limit,
        },
        estimated_cost: deployment.cost.estimated_cost,
        budget_limit,
        created_at: deployment.created_at,
      });

    if (deploymentError) {
      console.error('[Lambda API] Failed to store deployment:', deploymentError);
      // Continue anyway - instance is launched
    }

    console.log('[Lambda API] Deployment successful');

    return NextResponse.json({
      deployment_id: deployment.deployment_id,
      instance_id: deployment.instance_id,
      instance_ip: deployment.instance_ip,
      status: deployment.status,
      instance_type: deployment.instance_type,
      region: deployment.region,
      cost: deployment.cost,
      created_at: deployment.created_at,
      job_id: jobId,
      message: 'Lambda Labs deployment created successfully',
    });

  } catch (error) {
    console.error('[Lambda API] Deployment failed:', error);

    // Attempt cleanup if instance was created
    if (instanceId && supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const secret = await secretsManager.getSecret(user.id, 'lambda', supabase);
          if (secret) {
            const lambdaApiKey = decrypt(secret.api_key_encrypted);
            await lambdaService.terminateInstance(instanceId, lambdaApiKey);
            console.log('[Lambda API] Cleaned up instance after error');
          }
        }
      } catch (cleanupError) {
        console.error('[Lambda API] Cleanup failed:', cleanupError);
      }
    }

    // Check if error is due to GPU unavailability
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isCapacityError = errorMessage.toLowerCase().includes('capacity') ||
                           errorMessage.toLowerCase().includes('unavailable');

    if (isCapacityError && instance_type && region) {
      // Provide helpful guidance for capacity issues
      const gpuName = instance_type.replace('gpu_1x_', '').toUpperCase();

      return NextResponse.json(
        {
          error: 'GPU Unavailable',
          error_type: 'capacity',
          message: `The ${gpuName} GPU is currently unavailable in ${region}.`,
          details: errorMessage,
          suggestions: [
            'Try a different GPU type (A10 or RTX 6000 are usually available)',
            'Select a different region (us-east-1, us-west-2, or us-south-1)',
            'Wait a few minutes and try again - availability changes frequently'
          ],
          alternatives: {
            gpus: ['gpu_1x_a10', 'gpu_1x_rtx6000'],
            regions: ['us-east-1', 'us-west-2', 'us-south-1']
          }
        },
        { status: 503 } // 503 = Service Unavailable
      );
    }

    // Generic error response for other failures
    return NextResponse.json(
      {
        error: 'Failed to deploy to Lambda Labs',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get Lambda Labs deployment status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deployment_id');

    if (!deploymentId) {
      return NextResponse.json(
        { error: 'Missing deployment_id parameter' },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Lambda Labs API key
    const secret = await secretsManager.getSecret(user.id, 'lambda', supabase);
    
    if (!secret) {
      return NextResponse.json(
        { error: 'Lambda Labs API key not configured' },
        { status: 400 }
      );
    }

    const lambdaApiKey = decrypt(secret.api_key_encrypted);

    // Get instance status
    const status = await lambdaService.getInstanceStatus(deploymentId, lambdaApiKey);

    if (!status) {
      return NextResponse.json(
        { error: 'Deployment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(status);

  } catch (error) {
    console.error('[Lambda API] Status check failed:', error);
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
// DELETE - Terminate Lambda Labs instance
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deployment_id');

    if (!deploymentId) {
      return NextResponse.json(
        { error: 'Missing deployment_id parameter' },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Lambda Labs API key
    const secret = await secretsManager.getSecret(user.id, 'lambda', supabase);
    
    if (!secret) {
      return NextResponse.json(
        { error: 'Lambda Labs API key not configured' },
        { status: 400 }
      );
    }

    const lambdaApiKey = decrypt(secret.api_key_encrypted);

    // Terminate instance
    await lambdaService.terminateInstance(deploymentId, lambdaApiKey);

    // Update database
    await supabase
      .from('cloud_deployments')
      .update({
        status: 'stopped',
        completed_at: new Date().toISOString(),
      })
      .eq('deployment_id', deploymentId)
      .eq('user_id', user.id);

    return NextResponse.json({
      deployment_id: deploymentId,
      status: 'stopped',
      message: 'Lambda Labs deployment terminated successfully',
    });

  } catch (error) {
    console.error('[Lambda API] Termination failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to terminate deployment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER: Generate training script for Lambda Labs
// ============================================================================

function generateLambdaTrainingScript(
  packageDownloadUrl: string,
  jobId: string,
  jobToken: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  supabaseServiceKey: string,
  metricsUrl: string,
  userId: string,
  hfToken?: string,
  hfRepoName?: string
): string {
  return `#!/bin/bash
set -e

# Redirect all output to log file
exec > >(tee -a /home/ubuntu/training-setup.log)
exec 2>&1

echo "=================================================="
echo "FineTune Lab - Lambda Labs Cloud Training"
echo "=================================================="
echo "Job ID: ${jobId}"
echo "User ID: ${userId}"
echo "Starting at: $(date)"
echo "=================================================="

# NOTE: Do NOT wait for cloud-init status --wait here, as this script runs AS PART of cloud-init
# and would cause a deadlock.

# Install Lambda Guest Agent
echo "Installing Lambda Guest Agent..."
curl -L https://lambdalabs-guest-agent.s3.us-west-2.amazonaws.com/scripts/install.sh | sudo bash
echo "Lambda Guest Agent installed successfully"

# Update system and install Python dependencies
echo "Installing Python dependencies..."
sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y python3-pip python3-venv wget unzip
echo "Package installation complete"

# Create virtual environment to avoid PEP 668 errors
echo "Creating virtual environment..."
python3 -m venv /home/ubuntu/venv
source /home/ubuntu/venv/bin/activate
echo "Virtual environment activated"

# Download and extract training package
echo "Downloading training package..."
mkdir -p /home/ubuntu/training
cd /home/ubuntu/training

wget -O training-package.zip "${packageDownloadUrl}"
echo "Package downloaded, extracting..."
unzip -q training-package.zip

echo "Training package extracted successfully"
echo "Package contents:"
ls -la

# Verify essential files exist
if [ ! -f "train.py" ]; then
  echo "ERROR: train.py not found after extraction"
  echo "Contents of current directory:"
  ls -la
  exit 1
fi

if [ ! -f "config.json" ]; then
  echo "ERROR: config.json not found after extraction"
  exit 1
fi

echo "Package validation successful - train.py and config.json found"

# Set up environment variables for cloud training
export JOB_ID="${jobId}"
export JOB_TOKEN="${jobToken}"
export METRICS_API_URL="${metricsUrl}"
export NEXT_PUBLIC_SUPABASE_URL="${supabaseUrl}"
export SUPABASE_ANON_KEY="${supabaseAnonKey}"
export SUPABASE_SERVICE_ROLE_KEY="${supabaseServiceKey}"

# Performance tuning for cloud training
export DEFAULT_DATALOADER_NUM_WORKERS="4"
export DEFAULT_DATALOADER_PREFETCH_FACTOR="2"
export DEFAULT_PRETOKENIZE="true"
${hfToken && hfRepoName ? `export HF_TOKEN="${hfToken}"
export HF_REPO_NAME="${hfRepoName}"
echo "✓ HuggingFace model upload enabled: ${hfRepoName}"` : '# HuggingFace upload disabled (no credentials)'}

echo "Environment variables configured"

# Install Python dependencies
echo "Installing Python dependencies..."
/home/ubuntu/venv/bin/pip install --upgrade pip
/home/ubuntu/venv/bin/pip install -r requirements.txt

echo "Dependencies installed successfully"

# Run training
echo "=================================================="
echo "Starting Training..."
echo "=================================================="

# Run training with error handling
if /home/ubuntu/venv/bin/python3 train.py; then
    echo "=================================================="
    echo "✓ Training completed successfully at: $(date)"
    echo "=================================================="
    
    # Fix permissions for ubuntu user so they can access files via SSH
    chown -R ubuntu:ubuntu /home/ubuntu/training
    chown -R ubuntu:ubuntu /home/ubuntu/venv
else
    TRAINING_EXIT_CODE=$?
    echo "=================================================="
    echo "✗ Training failed with exit code: $TRAINING_EXIT_CODE"
    echo "Check logs for details"
    echo "=================================================="
    
    # Attempt to fix permissions even on failure to allow log inspection
    chown -R ubuntu:ubuntu /home/ubuntu/training || true
    
    exit $TRAINING_EXIT_CODE
fi
`.trim();
}
