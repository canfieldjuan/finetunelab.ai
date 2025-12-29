/**
 * AWS SageMaker Deployment API Route
 * Purpose: Deploy training jobs to AWS SageMaker
 * Date: 2025-12-18
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SageMakerService } from '@/lib/training/sagemaker-service';
import { secretsManager } from '@/lib/secrets/secrets-manager.service';
import { decrypt } from '@/lib/models/encryption';
import type { SageMakerDeploymentRequest } from '@/lib/training/deployment.types';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let jobId: string | undefined;
  let supabase: SupabaseClient | undefined;
  let training_job_name: string | undefined;

  try {
    console.log('[SageMaker API] Received deployment request');

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[SageMaker API] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: SageMakerDeploymentRequest = await request.json();
    const { training_config_id, instance_type, use_spot_instances = true } = body;

    console.log('[SageMaker API] Request:', {
      training_config_id,
      instance_type,
      use_spot_instances,
      user_id: user.id,
    });

    if (!training_config_id || !instance_type) {
      return NextResponse.json(
        { error: 'Missing required fields: training_config_id, instance_type' },
        { status: 400 }
      );
    }

    const awsSecret = await secretsManager.getSecret(user.id, 'aws', supabase);
    if (!awsSecret) {
      return NextResponse.json(
        { error: 'AWS credentials not configured. Please add AWS secrets in Settings → Secrets' },
        { status: 400 }
      );
    }

    const awsSecretAccessKey = decrypt(awsSecret.api_key_encrypted);
    const awsMetadata = awsSecret.metadata?.aws;

    if (!awsMetadata) {
      return NextResponse.json(
        { error: 'AWS metadata not found in secrets' },
        { status: 400 }
      );
    }

    const awsAccessKeyId = awsMetadata.access_key_id;
    if (!awsAccessKeyId) {
      return NextResponse.json(
        { error: 'AWS Access Key ID not configured in metadata' },
        { status: 400 }
      );
    }

    if (!awsMetadata.iam_role_arn) {
      return NextResponse.json(
        { error: 'IAM role ARN not configured. Required for SageMaker execution.' },
        { status: 400 }
      );
    }

    const awsRegion = awsMetadata.region || 'us-east-1';
    const s3Bucket = awsMetadata.s3_bucket;

    if (!s3Bucket) {
      return NextResponse.json(
        { error: 'S3 bucket not configured in AWS secrets' },
        { status: 400 }
      );
    }

    console.log('[SageMaker API] AWS credentials validated:', {
      region: awsRegion,
      bucket: s3Bucket,
      has_role_arn: !!awsMetadata.iam_role_arn,
    });

    const { data: trainingConfig, error: configError } = await supabase
      .from('training_configs')
      .select('*')
      .eq('id', training_config_id)
      .eq('user_id', user.id)
      .single();

    if (configError || !trainingConfig) {
      console.error('[SageMaker API] Training config not found:', configError);
      return NextResponse.json(
        { error: 'Training configuration not found' },
        { status: 404 }
      );
    }

    console.log('[SageMaker API] Retrieved training config:', trainingConfig.name);

    const { data: datasetLinks, error: linksError } = await supabase
      .from('training_config_datasets')
      .select('dataset_id')
      .eq('config_id', training_config_id);

    if (linksError || !datasetLinks || datasetLinks.length === 0) {
      return NextResponse.json(
        { error: 'No datasets attached to training configuration' },
        { status: 400 }
      );
    }

    const datasetIds = datasetLinks.map(link => link.dataset_id);

    const { data: datasets, error: datasetsError } = await supabase
      .from('training_datasets')
      .select('*')
      .in('id', datasetIds);

    if (datasetsError || !datasets || datasets.length === 0) {
      return NextResponse.json(
        { error: 'Failed to fetch datasets' },
        { status: 500 }
      );
    }

    const nonS3Datasets = datasets.filter(d => d.storage_provider !== 's3');
    if (nonS3Datasets.length > 0) {
      return NextResponse.json(
        {
          error: 'SageMaker requires datasets in S3 storage',
          details: `${nonS3Datasets.length} dataset(s) not in S3. Please upload to S3 first.`,
          non_s3_datasets: nonS3Datasets.map(d => ({
            id: d.id,
            name: d.name,
            storage_provider: d.storage_provider
          }))
        },
        { status: 400 }
      );
    }

    console.log('[SageMaker API] All datasets verified in S3:', datasets.length);

    jobId = crypto.randomUUID();
    const jobToken = crypto.randomBytes(32).toString('base64url');

    const modelName = trainingConfig.config_json?.model?.name ||
                      trainingConfig.model_name ||
                      'Qwen/Qwen2.5-0.5B-Instruct';

    console.log('[SageMaker API] Using model:', modelName);

    const { error: jobError } = await supabase
      .from('local_training_jobs')
      .insert({
        id: jobId,
        user_id: user.id,
        model_name: modelName,
        dataset_path: datasets[0].storage_path,
        status: 'pending',
        job_token: jobToken,
        config: trainingConfig.config_json,
        started_at: new Date().toISOString()
      });

    if (jobError) {
      console.error('[SageMaker API] Failed to create job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create training job' },
        { status: 500 }
      );
    }

    console.log('[SageMaker API] Created job:', jobId);

    const primaryDataset = datasets[0];
    const s3DatasetPath = `s3://${s3Bucket}/${primaryDataset.storage_path}`;
    const s3OutputPath = `s3://${s3Bucket}/checkpoints/${user.id}/${training_config_id}`;

    console.log('[SageMaker API] S3 paths:', { dataset: s3DatasetPath, output: s3OutputPath });

    const hyperparameters: Record<string, string> = {
      training_method: String(trainingConfig.config_json?.training?.method || 'sft'),
      num_epochs: String(trainingConfig.config_json?.training?.num_epochs || 3),
      batch_size: String(trainingConfig.config_json?.training?.batch_size || 4),
      learning_rate: String(trainingConfig.config_json?.training?.learning_rate || 2e-4),
      model_name: modelName,
      job_id: jobId,
      job_token: jobToken,
      supabase_url: supabaseUrl,
      supabase_anon_key: supabaseAnonKey,
    };

    console.log('[SageMaker API] Hyperparameters:', hyperparameters);

    const sagemakerService = new SageMakerService({
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
      region: awsRegion,
      roleArn: awsMetadata.iam_role_arn,
    });

    console.log('[SageMaker API] Creating training job...');
    const deploymentResponse = await sagemakerService.createTrainingJob(
      body,
      s3DatasetPath,
      s3OutputPath,
      hyperparameters
    );

    training_job_name = deploymentResponse.training_job_name;

    console.log('[SageMaker API] Training job created:', training_job_name);

    const { error: deploymentError } = await supabase
      .from('cloud_deployments')
      .insert({
        user_id: user.id,
        platform: 'sagemaker',
        training_config_id,
        deployment_id: training_job_name,
        status: 'creating',
        url: `https://console.aws.amazon.com/sagemaker/home?region=${awsRegion}#/jobs/${training_job_name}`,
        config: {
          instance_type,
          use_spot_instances,
          s3_dataset_path: s3DatasetPath,
          s3_output_path: s3OutputPath,
        },
        estimated_cost: deploymentResponse.cost.estimated_cost,
        budget_limit: body.budget_limit,
      });

    if (deploymentError) {
      console.error('[SageMaker API] Failed to store deployment:', deploymentError);
    }

    console.log('[SageMaker API] Deployment successful');

    return NextResponse.json({
      success: true,
      deployment_id: deploymentResponse.deployment_id,
      training_job_name: deploymentResponse.training_job_name,
      training_job_arn: deploymentResponse.training_job_arn,
      status: deploymentResponse.status,
      instance_type: deploymentResponse.instance_type,
      instance_count: deploymentResponse.instance_count,
      use_spot_instances: deploymentResponse.use_spot_instances,
      cost: deploymentResponse.cost,
      s3_output_path: deploymentResponse.s3_output_path,
      cloudwatch_log_group: deploymentResponse.cloudwatch_log_group,
      created_at: deploymentResponse.created_at,
      job_id: jobId,
      url: `https://console.aws.amazon.com/sagemaker/home?region=${awsRegion}#/jobs/${training_job_name}`,
      region: awsRegion,
      message: 'SageMaker deployment created successfully',
    });

  } catch (error) {
    console.error('[SageMaker API] Deployment failed:', error);

    if (training_job_name && supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const awsSecret = await secretsManager.getSecret(user.id, 'aws', supabase);
          if (awsSecret && awsSecret.metadata?.aws) {
            const awsSecretAccessKey = decrypt(awsSecret.api_key_encrypted);
            const awsMetadata = awsSecret.metadata.aws;
            const awsAccessKeyId = awsMetadata.access_key_id;
            if (awsAccessKeyId && awsMetadata.iam_role_arn) {
              const sagemakerService = new SageMakerService({
                accessKeyId: awsAccessKeyId,
                secretAccessKey: awsSecretAccessKey,
                region: awsMetadata.region || 'us-east-1',
                roleArn: awsMetadata.iam_role_arn,
              });
              await sagemakerService.stopTrainingJob(training_job_name);
              console.log('[SageMaker API] Stopped training job after error');
            }
          }
        }
      } catch (cleanupError) {
        console.error('[SageMaker API] Cleanup failed:', cleanupError);
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'SageMaker deployment failed',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('[SageMaker API] Received status check request');

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

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

    const { searchParams } = new URL(request.url);
    const jobName = searchParams.get('job_name');

    if (!jobName) {
      return NextResponse.json(
        { error: 'Missing job_name parameter' },
        { status: 400 }
      );
    }

    const awsSecret = await secretsManager.getSecret(user.id, 'aws', supabase);
    if (!awsSecret || !awsSecret.metadata?.aws) {
      return NextResponse.json(
        { error: 'AWS credentials not configured' },
        { status: 400 }
      );
    }

    const awsSecretAccessKey = decrypt(awsSecret.api_key_encrypted);
    const awsMetadata = awsSecret.metadata.aws;
    const awsAccessKeyId = awsMetadata.access_key_id;

    if (!awsAccessKeyId || !awsMetadata.iam_role_arn) {
      return NextResponse.json(
        { error: 'AWS credentials incomplete in metadata' },
        { status: 400 }
      );
    }

    const sagemakerService = new SageMakerService({
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
      region: awsMetadata.region || 'us-east-1',
      roleArn: awsMetadata.iam_role_arn,
    });

    const status = await sagemakerService.getTrainingJobStatus(jobName);

    return NextResponse.json(status);

  } catch (error) {
    console.error('[SageMaker API] Status check failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to get training job status',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('[SageMaker API] Received stop request');

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

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

    const { searchParams } = new URL(request.url);
    const jobName = searchParams.get('job_name');

    if (!jobName) {
      return NextResponse.json(
        { error: 'Missing job_name parameter' },
        { status: 400 }
      );
    }

    const awsSecret = await secretsManager.getSecret(user.id, 'aws', supabase);
    if (!awsSecret || !awsSecret.metadata?.aws) {
      return NextResponse.json(
        { error: 'AWS credentials not configured' },
        { status: 400 }
      );
    }

    const awsSecretAccessKey = decrypt(awsSecret.api_key_encrypted);
    const awsMetadata = awsSecret.metadata.aws;
    const awsAccessKeyId = awsMetadata.access_key_id;

    if (!awsAccessKeyId || !awsMetadata.iam_role_arn) {
      return NextResponse.json(
        { error: 'AWS credentials incomplete in metadata' },
        { status: 400 }
      );
    }

    const sagemakerService = new SageMakerService({
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
      region: awsMetadata.region || 'us-east-1',
      roleArn: awsMetadata.iam_role_arn,
    });

    await sagemakerService.stopTrainingJob(jobName);

    await supabase
      .from('cloud_deployments')
      .update({ status: 'stopping' })
      .eq('deployment_id', jobName)
      .eq('user_id', user.id);

    console.log('[SageMaker API] Training job stopped:', jobName);

    return NextResponse.json({
      success: true,
      message: 'Training job stop requested',
      job_name: jobName,
    });

  } catch (error) {
    console.error('[SageMaker API] Stop request failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to stop training job',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
