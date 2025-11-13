/**
 * Training Execution API
 * POST /api/training/execute
 * Purpose: Trigger training execution via different providers
 * Supports: Colab, HuggingFace, OpenAI, Local
 * Date: 2025-10-24
 * Updated: 2025-01-07 - Integrated with local training server at port 8000
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import OpenAI from 'openai';
import type {
  TrainingExecutionRequest,
  TrainingExecutionResponse,
} from '@/lib/training/execution-types';
import { LocalTrainingProvider } from '@/lib/services/training-providers/local.provider';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  console.log('[TrainingExecute] POST /api/training/execute');

  try {
    // 1. Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[TrainingExecute] Missing authorization header');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Extract access token from Bearer header
    const accessToken = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[TrainingExecute] Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[TrainingExecute] Authenticated user:', user.id);

    // Continue to validation...
    return await handleTrainingExecution(request, supabase, user, accessToken);

  } catch (error) {
    console.error('[TrainingExecute] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function for main execution logic
async function handleTrainingExecution(
  request: NextRequest,
  supabase: any,
  user: any,
  accessToken: string
) {
  // 2. Parse and validate request
  const body: TrainingExecutionRequest = await request.json();
  const {
    public_id,
    method,
    provider,
    callback_url,
    openai_model,
    openai_n_epochs,
    openai_batch_size,
    openai_learning_rate_multiplier,
  } = body;

  console.log('[TrainingExecute] Request:', {
    public_id,
    method,
    provider,
    callback_url: callback_url ? 'provided' : 'none',
    openai_model: openai_model || 'default',
  });

  // Validate required fields
  if (!public_id || !method || !provider) {
    console.error('[TrainingExecute] Missing required fields');
    return NextResponse.json(
      { error: 'Missing required fields: public_id, method, provider' },
      { status: 400 }
    );
  }

  if (!['sft', 'dpo', 'rlhf'].includes(method)) {
    console.error('[TrainingExecute] Invalid method:', method);
    return NextResponse.json(
      { error: 'Invalid method. Must be sft, dpo, or rlhf' },
      { status: 400 }
    );
  }

  const validProviders = ['colab', 'huggingface', 'openai', 'local'];
  if (!validProviders.includes(provider)) {
    console.error('[TrainingExecute] Invalid provider:', provider);
    return NextResponse.json(
      { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
      { status: 400 }
    );
  }

  // Continue to config verification...
  return await verifyConfigAndExecute(
    supabase,
    user,
    public_id,
    method,
    provider,
    {
      callback_url,
      openai_model,
      openai_n_epochs,
      openai_batch_size,
      openai_learning_rate_multiplier,
    },
    accessToken
  );
}

// Helper function to verify config and execute training
async function verifyConfigAndExecute(
  supabase: any,
  user: any,
  public_id: string,
  method: string,
  provider: string,
  options: any,
  accessToken: string
) {
  // 3. Verify public_id exists and get config
  const { data: config, error: configError } = await supabase
    .from('training_configs')
    .select('id, name, public_id, gist_urls, config_json')
    .eq('public_id', public_id)
    .eq('is_public', true)
    .single();

  if (configError || !config) {
    console.error('[TrainingExecute] Config not found:', public_id);
    return NextResponse.json(
      { error: 'Training config not found or not public' },
      { status: 404 }
    );
  }

  console.log('[TrainingExecute] Config found:', config.name);

  // 4. Create execution record
  const executionId = `exec_${crypto.randomUUID()}`;
  const startedAt = new Date().toISOString();

  const executionRecord = {
    id: executionId,
    user_id: user.id,
    public_id,
    method,
    provider,
    status: 'pending' as const,
    callback_url: options.callback_url || null,
    config: options,
    started_at: startedAt,
  };

  console.log('[TrainingExecute] Creating execution record:', executionId);

  // 5. Route to provider-specific handler
  return await routeToProvider(
    supabase,
    user,
    executionRecord,
    config,
    method,
    provider,
    options,
    accessToken
  );
}

// Provider routing function
async function routeToProvider(
  supabase: any,
  user: any,
  executionRecord: any,
  config: any,
  method: string,
  provider: string,
  options: any,
  accessToken: string
): Promise<NextResponse> {
  console.log('[TrainingExecute] Routing to provider:', provider);

  switch (provider) {
    case 'colab':
      return await handleColabProvider(supabase, executionRecord, config, method);

    case 'openai':
      return await handleOpenAIProvider(supabase, executionRecord, config, method, options);

    case 'huggingface':
      return await handleHuggingFaceProvider(supabase, executionRecord, config, method);

    case 'local':
      return await handleLocalProvider(supabase, user, executionRecord, config, method, accessToken);

    default:
      console.error('[TrainingExecute] Unknown provider:', provider);
      return NextResponse.json(
        { error: `Unknown provider: ${provider}` },
        { status: 400 }
      );
  }
}

// Colab Provider Handler
async function handleColabProvider(
  supabase: any,
  executionRecord: any,
  config: any,
  method: string
): Promise<NextResponse> {
  console.log('[TrainingExecute] Handling Colab provider for method:', method);

  const gistUrls = config.gist_urls as Record<string, string>;
  const colabUrl = gistUrls?.[method];

  if (!colabUrl) {
    console.error('[TrainingExecute] No Colab URL found for method:', method);
    return NextResponse.json(
      { error: `No Colab notebook found for ${method}. Generate package first.` },
      { status: 404 }
    );
  }

  // Insert execution record with Colab URL
  const { error: insertError } = await supabase
    .from('training_executions')
    .insert({
      ...executionRecord,
      colab_url: colabUrl,
    });

  if (insertError) {
    console.error('[TrainingExecute] Error creating execution:', insertError);
    return NextResponse.json(
      { error: 'Failed to create execution record' },
      { status: 500 }
    );
  }

  console.log('[TrainingExecute] Colab execution created:', executionRecord.id);

  const response: TrainingExecutionResponse = {
    execution_id: executionRecord.id,
    status: 'pending',
    provider: 'colab',
    colab_url: colabUrl,
    message: 'Open Colab notebook to start training',
    started_at: executionRecord.started_at,
  };

  return NextResponse.json(response);
}

// OpenAI Provider Handler
async function handleOpenAIProvider(
  supabase: any,
  executionRecord: any,
  config: any,
  method: string,
  options: any
): Promise<NextResponse> {
  console.log('[TrainingExecute] Handling OpenAI provider for method:', method);

  // Verify OpenAI API key is configured
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error('[TrainingExecute] OPENAI_API_KEY not configured');
    return NextResponse.json(
      { error: 'OpenAI integration not configured. Contact administrator.' },
      { status: 500 }
    );
  }

  // Initialize OpenAI client
  const openai = new OpenAI({ apiKey: openaiApiKey });

  try {
    // Get training file from config
    const trainingFileId = await prepareOpenAITrainingFile(
      supabase,
      config,
      method,
      openai
    );

    if (!trainingFileId) {
      console.error('[TrainingExecute] Failed to prepare training file');
      return NextResponse.json(
        { error: 'Failed to prepare training data for OpenAI' },
        { status: 500 }
      );
    }

    console.log('[TrainingExecute] Training file prepared:', trainingFileId);

    // Create fine-tuning job with OpenAI
    const model = options.openai_model || 'gpt-3.5-turbo';
    const hyperparameters: any = {};

    if (options.openai_n_epochs) {
      hyperparameters.n_epochs = options.openai_n_epochs;
    }
    if (options.openai_batch_size) {
      hyperparameters.batch_size = options.openai_batch_size;
    }
    if (options.openai_learning_rate_multiplier) {
      hyperparameters.learning_rate_multiplier = options.openai_learning_rate_multiplier;
    }

    console.log('[TrainingExecute] Creating OpenAI fine-tuning job:', {
      model,
      training_file: trainingFileId,
      hyperparameters,
    });

    const fineTuningJob = await openai.fineTuning.jobs.create({
      training_file: trainingFileId,
      model,
      hyperparameters: Object.keys(hyperparameters).length > 0 ? hyperparameters : undefined,
    });

    console.log('[TrainingExecute] OpenAI job created:', fineTuningJob.id);

    // Insert execution record with OpenAI job ID
    const { error: insertError } = await supabase
      .from('training_executions')
      .insert({
        ...executionRecord,
        openai_job_id: fineTuningJob.id,
        status: 'running',
      });

    if (insertError) {
      console.error('[TrainingExecute] Error creating execution:', insertError);
      return NextResponse.json(
        { error: 'Failed to create execution record' },
        { status: 500 }
      );
    }

    console.log('[TrainingExecute] OpenAI execution created:', executionRecord.id);

    const response: TrainingExecutionResponse = {
      execution_id: executionRecord.id,
      status: 'running',
      provider: 'openai',
      openai_job_id: fineTuningJob.id,
      message: `OpenAI fine-tuning job started: ${fineTuningJob.id}`,
      started_at: executionRecord.started_at,
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[TrainingExecute] OpenAI error:', error);
    return NextResponse.json(
      { error: `OpenAI API error: ${error.message}` },
      { status: 500 }
    );
  }
}

// Helper: Prepare OpenAI training file
async function prepareOpenAITrainingFile(
  supabase: any,
  config: any,
  method: string,
  openai: OpenAI
): Promise<string | null> {
  console.log('[TrainingExecute] Preparing OpenAI training file for config:', config.id);

  try {
    // Fetch datasets linked to this config via junction table
    const { data: configDatasets, error: datasetsError } = await supabase
      .from('training_config_datasets')
      .select(`
        training_datasets (*)
      `)
      .eq('config_id', config.id);

    // Extract datasets from junction table
    const datasets = (configDatasets || [])
      .map((cd: any) => cd.training_datasets)
      .filter((d: any): d is NonNullable<typeof d> => d !== null);

    if (datasetsError || !datasets || datasets.length === 0) {
      console.error('[TrainingExecute] No datasets found for config:', config.id);
      return null;
    }

    console.log('[TrainingExecute] Found datasets:', datasets.length);

    // Download and convert datasets to OpenAI format
    const openaiExamples: string[] = [];

    for (const dataset of datasets) {
      // Get signed URL for dataset
      const { data: urlData } = await supabase.storage
        .from('training-datasets')
        .createSignedUrl(dataset.storage_path, 3600);

      if (!urlData?.signedUrl) {
        console.error('[TrainingExecute] No signed URL for dataset:', dataset.id);
        continue;
      }

      // Download dataset content
      const response = await fetch(urlData.signedUrl);
      const content = await response.text();

      // Convert to OpenAI format (line by line)
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const example = JSON.parse(line);
          const openaiExample = convertToOpenAIFormat(example, method);
          if (openaiExample) {
            openaiExamples.push(JSON.stringify(openaiExample));
          }
        } catch (e) {
          console.error('[TrainingExecute] Failed to parse line:', e);
        }
      }
    }

    if (openaiExamples.length === 0) {
      console.error('[TrainingExecute] No valid examples found');
      return null;
    }

    console.log('[TrainingExecute] Converted examples:', openaiExamples.length);

    // Create JSONL content
    const jsonlContent = openaiExamples.join('\n');

    // Upload to OpenAI
    const file = await openai.files.create({
      file: new File([jsonlContent], 'training.jsonl', { type: 'application/jsonl' }),
      purpose: 'fine-tune',
    });

    console.log('[TrainingExecute] File uploaded to OpenAI:', file.id);
    return file.id;

  } catch (error: any) {
    console.error('[TrainingExecute] Error preparing training file:', error);
    return null;
  }
}

// Helper: Convert dataset format to OpenAI format
function convertToOpenAIFormat(example: any, method: string): any {
  console.log('[TrainingExecute] Converting example to OpenAI format');

  // OpenAI expects: { "messages": [{"role": "system", "content": "..."}, ...] }
  try {
    // Handle ChatML format
    if (Array.isArray(example)) {
      return {
        messages: example.map((msg: any) => ({
          role: msg.role || 'user',
          content: msg.content || '',
        })),
      };
    }

    // Handle ShareGPT format
    if (example.conversations && Array.isArray(example.conversations)) {
      const messages = example.conversations.map((turn: any) => ({
        role: turn.from === 'human' ? 'user' : 'assistant',
        content: turn.value || '',
      }));
      return { messages };
    }

    // Handle simple prompt/completion format
    if (example.prompt && example.completion) {
      return {
        messages: [
          { role: 'user', content: example.prompt },
          { role: 'assistant', content: example.completion },
        ],
      };
    }

    console.error('[TrainingExecute] Unknown example format:', example);
    return null;

  } catch (error) {
    console.error('[TrainingExecute] Error converting format:', error);
    return null;
  }
}

// HuggingFace Provider Handler (Stub)
async function handleHuggingFaceProvider(
  supabase: any,
  executionRecord: any,
  config: any,
  method: string
): Promise<NextResponse> {
  console.log('[TrainingExecute] HuggingFace provider not yet implemented');

  return NextResponse.json(
    {
      error: 'HuggingFace provider not yet implemented',
      message: 'Use Colab or OpenAI provider for now',
    },
    { status: 501 }
  );
}

// Local Provider Handler - Calls Training Server at localhost:8000
async function handleLocalProvider(
  supabase: any,
  user: any,
  executionRecord: any,
  config: any,
  method: string,
  accessToken: string
): Promise<NextResponse> {
  console.log('[TrainingExecute] Starting local training via training server...');
  console.log('[TrainingExecute] Method:', method);
  console.log('[TrainingExecute] Execution ID:', executionRecord.id);
  console.log('[TrainingExecute] Config ID:', config.id);

  try {
    if (!config.config_json) {
      console.error('[TrainingExecute] Missing config_json in config');
      return NextResponse.json(
        { 
          error: 'Missing training configuration',
          details: 'config_json is required'
        },
        { status: 400 }
      );
    }
    
    const trainingConfig = config.config_json;
    console.log('[TrainingExecute] Training config loaded');
    console.log('[TrainingExecute] Model:', trainingConfig.model?.name);
    console.log('[TrainingExecute] Method:', trainingConfig.training?.method);
    
    // Fetch datasets via junction table
    const { data: configDatasets, error: datasetsError } = await supabase
      .from('training_config_datasets')
      .select(`
        training_datasets (*)
      `)
      .eq('config_id', config.id);

    // Extract datasets from junction table
    const datasets = (configDatasets || [])
      .map((cd: any) => cd.training_datasets)
      .filter((d: any): d is NonNullable<typeof d> => d !== null);

    if (datasetsError || !datasets || datasets.length === 0) {
      console.error('[TrainingExecute] No datasets found for config:', config.id);
      return NextResponse.json(
        {
          error: 'No dataset attached',
          details: 'Please attach a dataset to this training config first'
        },
        { status: 400 }
      );
    }

    console.log('[TrainingExecute] Found datasets:', datasets.length);
    const dataset = datasets[0];
    console.log('[TrainingExecute] Using dataset:', dataset.name);
    console.log('[TrainingExecute] Storage path:', dataset.storage_path);
    
    const datasetContent: unknown[] = [];
    
    try {
      const { data: urlData } = await supabase.storage
        .from('training-datasets')
        .createSignedUrl(dataset.storage_path, 3600);

      if (!urlData?.signedUrl) {
        throw new Error('Failed to create signed URL for dataset');
      }

      console.log('[TrainingExecute] Downloading dataset from storage...');
      const response = await fetch(urlData.signedUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download dataset: ${response.statusText}`);
      }
      
      const contentText = await response.text();
      const lines = contentText.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const example = JSON.parse(line);
          datasetContent.push(example);
        } catch {
          console.warn('[TrainingExecute] Skipping invalid JSON line');
        }
      }
      
      console.log('[TrainingExecute] Dataset loaded:', datasetContent.length, 'examples');
      
    } catch (error) {
      console.error('[TrainingExecute] Failed to load dataset:', error);
      return NextResponse.json(
        {
          error: 'Failed to load dataset',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
    
    if (datasetContent.length === 0) {
      console.error('[TrainingExecute] Dataset is empty');
      return NextResponse.json(
        {
          error: 'Empty dataset',
          details: 'Dataset has no valid examples'
        },
        { status: 400 }
      );
    }

    // Step 2: Get local provider configuration from user settings
    const { data: providerSettings } = await supabase
      .from('user_settings')
      .select('value')
      .eq('key', 'training_provider_local')
      .single();

    const providerConfig = providerSettings?.value || {
      base_url: 'http://localhost:8000',
      timeout_ms: 5000
    };

    console.log('[TrainingExecute] Provider config:', providerConfig);

    // Step 3: Initialize LocalTrainingProvider
    const provider = new LocalTrainingProvider(providerConfig);

    // Step 4: Test connection
    const connectionTest = await provider.validateConnection();
    if (!connectionTest.success) {
      console.error('[TrainingExecute] Training server not available:', connectionTest.error);
      
      await supabase
        .from('training_executions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          result: {
            success: false,
            error: `Training server not available: ${connectionTest.error}`,
          },
        })
        .eq('id', executionRecord.id);

      return NextResponse.json(
        {
          error: 'Training server not available',
          details: connectionTest.error,
        },
        { status: 503 }
      );
    }

    console.log('[TrainingExecute] Training server is healthy');

    const tempDir = join(tmpdir(), 'finetune-lab');
    await mkdir(tempDir, { recursive: true });
    
    const datasetFilename = `dataset_${executionRecord.id}.json`;
    const datasetPath = join(tempDir, datasetFilename);
    
    console.log('[TrainingExecute] Writing dataset to temp file:', datasetPath);
    await writeFile(datasetPath, JSON.stringify(datasetContent, null, 2), 'utf-8');
    console.log('[TrainingExecute] Dataset file created successfully');

    const trainingRequest = {
      config: trainingConfig,
      dataset_path: datasetPath,
      execution_id: executionRecord.id,
      name: `Training ${executionRecord.id} - ${trainingConfig.model?.name || 'unknown'}`,
      user_id: user.id  // Pass user ID for database persistence
    };

    console.log('[TrainingExecute] Submitting job to training server');
    console.log('[TrainingExecute] Config model:', trainingConfig.model?.name);
    console.log('[TrainingExecute] Dataset path:', datasetPath);
    console.log('[TrainingExecute] Dataset examples:', datasetContent.length);
    
    const jobResult = await provider.executeTraining(trainingRequest);
    
    if (!jobResult.success) {
      console.error('[TrainingExecute] Failed to submit job:', jobResult.error);
      
      await supabase
        .from('training_executions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          result: {
            success: false,
            error: jobResult.error,
          },
        })
        .eq('id', executionRecord.id);

      return NextResponse.json(
        {
          error: 'Failed to submit training job',
          details: jobResult.error,
        },
        { status: 500 }
      );
    }

    console.log('[TrainingExecute] Job submitted successfully. Job ID:', jobResult.job_id);

    // Step 6: Update execution record with job ID and status
    await supabase
      .from('training_executions')
      .update({
        status: 'running',
        result: {
          job_id: jobResult.job_id,
          training_server_url: providerConfig.base_url,
        },
      })
      .eq('id', executionRecord.id);

    // Step 7: Return success response
    return NextResponse.json({
      success: true,
      execution_id: executionRecord.id,
      job_id: jobResult.job_id,
      status: 'running',
      message: 'Training job submitted successfully to local training server',
      training_server: providerConfig.base_url,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[TrainingExecute] Local provider error:', errorMessage);
    
    await supabase
      .from('training_executions')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        result: {
          success: false,
          error: errorMessage,
        },
      })
      .eq('id', executionRecord.id);

    return NextResponse.json(
      {
        error: 'Failed to start local training',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// Helper: Execute local training via Python subprocess
