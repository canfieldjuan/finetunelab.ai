/**
 * Training Execution API
 * POST /api/training/execute
 * Purpose: Trigger training execution via different providers
 * Supports: Colab, HuggingFace, OpenAI, RunPod Cloud
 * Date: 2025-10-24
 * Updated: 2025-01-07 - Integrated with cloud training infrastructure
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import OpenAI from 'openai';
import crypto from 'crypto';
import type {
  TrainingExecutionRequest,
  TrainingExecutionResponse,
  TrainingMethod,
  TrainingProvider,
} from '@/lib/training/execution-types';
import { LocalTrainingProvider } from '@/lib/services/training-providers/local.provider';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';
import type { LocalProviderConfig } from '@/lib/training/training-config.types';

export const runtime = 'nodejs';

type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

interface ExecutionOptions {
  callback_url?: string;
  openai_model?: string;
  openai_n_epochs?: number;
  openai_batch_size?: number;
  openai_learning_rate_multiplier?: number;
  [key: string]: unknown;
}

interface ExecutionRecord {
  id: string;
  user_id: string;
  public_id: string;
  method: TrainingMethod;
  provider: TrainingProvider;
  status: ExecutionStatus;
  callback_url: string | null;
  config: ExecutionOptions;
  started_at: string;
}

interface TrainingConfigJSON {
  model?: {
    name?: string;
  };
  training?: {
    method?: string;
  };
  [key: string]: unknown;
}

interface TrainingConfigRow {
  id: string;
  name: string;
  public_id: string | null;
  gist_urls: Record<string, string> | null;
  config_json: TrainingConfigJSON | null;
}

type ConfigDatasetRow = {
  training_datasets: TrainingDatasetRecord | null;
};

type ProviderSettingsRow = {
  value: LocalProviderConfig | null;
};

interface OpenAIMessage {
  role: string;
  content: string;
}

interface OpenAIFormattedExample {
  messages: OpenAIMessage[];
}

type ShareGPTTurn = {
  from?: string;
  value?: string;
};

interface ShareGPTExample {
  conversations: ShareGPTTurn[];
}

interface PromptCompletionExample {
  prompt: string;
  completion: string;
}

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
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
    return await handleTrainingExecution(request, supabase, user);

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
  supabase: SupabaseClient,
  user: User
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

  if (!['sft', 'dpo', 'rlhf', 'orpo', 'cpt'].includes(method)) {
    console.error('[TrainingExecute] Invalid method:', method);
    return NextResponse.json(
      { error: 'Invalid method. Must be sft, dpo, rlhf, orpo, or cpt' },
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
  const executionOptions: ExecutionOptions = {
    callback_url,
    openai_model,
    openai_n_epochs,
    openai_batch_size,
    openai_learning_rate_multiplier,
  };

  return await verifyConfigAndExecute(
    supabase,
    user,
    public_id,
    method as TrainingMethod,
    provider as TrainingProvider,
    executionOptions
  );
}

// Helper function to verify config and execute training
async function verifyConfigAndExecute(
  supabase: SupabaseClient,
  user: User,
  public_id: string,
  method: TrainingMethod,
  provider: TrainingProvider,
  options: ExecutionOptions
) {
  // 3. Verify public_id exists and get config
  const { data: config, error: configError } = await supabase
    .from('training_configs')
    .select('id, name, public_id, gist_urls, config_json')
    .eq('public_id', public_id)
    .eq('is_public', true)
    .single<TrainingConfigRow>();

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

  const executionRecord: ExecutionRecord = {
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
    options
  );
}

// Provider routing function
async function routeToProvider(
  supabase: SupabaseClient,
  user: User,
  executionRecord: ExecutionRecord,
  config: TrainingConfigRow,
  method: TrainingMethod,
  provider: TrainingProvider,
  options: ExecutionOptions
): Promise<NextResponse> {
  console.log('[TrainingExecute] Routing to provider:', provider);

  switch (provider) {
    case 'colab':
      return await handleColabProvider(supabase, executionRecord, config, method);

    case 'openai':
      return await handleOpenAIProvider(supabase, executionRecord, config, method, options);

    case 'huggingface':
      return await handleHuggingFaceProvider();

    case 'local':
      return await handleLocalProvider(supabase, user, executionRecord, config, method);

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
  supabase: SupabaseClient,
  executionRecord: ExecutionRecord,
  config: TrainingConfigRow,
  method: TrainingMethod
): Promise<NextResponse> {
  console.log('[TrainingExecute] Handling Colab provider for method:', method);

  const gistUrls = config.gist_urls || {};
  const colabUrl = gistUrls[method];

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
  supabase: SupabaseClient,
  executionRecord: ExecutionRecord,
  config: TrainingConfigRow,
  method: TrainingMethod,
  options: ExecutionOptions
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
    const hyperparameters: {
      n_epochs?: number;
      batch_size?: number;
      learning_rate_multiplier?: number;
    } = {};

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

  } catch (error) {
    console.error('[TrainingExecute] OpenAI error:', error);
    const message = error instanceof Error ? error.message : 'Unknown OpenAI error';
    return NextResponse.json(
      { error: `OpenAI API error: ${message}` },
      { status: 500 }
    );
  }
}

// Helper: Prepare OpenAI training file
async function prepareOpenAITrainingFile(
  supabase: SupabaseClient,
  config: TrainingConfigRow,
  method: TrainingMethod,
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

    if (datasetsError) {
      console.error('[TrainingExecute] Dataset fetch error:', datasetsError);
      return null;
    }

    // Extract datasets from junction table
    const datasets = ((configDatasets || []) as unknown as ConfigDatasetRow[])
      .map((cd) => cd.training_datasets)
      .filter((d): d is TrainingDatasetRecord => d !== null);

    if (datasets.length === 0) {
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
          const openaiExample = convertToOpenAIFormat(example);
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

  } catch (error) {
    console.error('[TrainingExecute] Error preparing training file:', error);
    return null;
  }
}

// Helper: Convert dataset format to OpenAI format
function convertToOpenAIFormat(example: unknown): OpenAIFormattedExample | null {
  console.log('[TrainingExecute] Converting example to OpenAI format');

  try {
    if (Array.isArray(example)) {
      const messages = example
        .map((msg) => {
          if (msg && typeof msg === 'object') {
            const role = (msg as { role?: string }).role || 'user';
            const content = (msg as { content?: string }).content || '';
            return { role, content };
          }
          return null;
        })
        .filter((msg): msg is OpenAIMessage => msg !== null);

      if (messages.length > 0) {
        return { messages };
      }
    }

    if (isShareGPTExample(example)) {
      const messages = example.conversations.map((turn) => ({
        role: turn.from === 'human' ? 'user' : 'assistant',
        content: turn.value || '',
      }));
      return { messages };
    }

    if (isPromptCompletionExample(example)) {
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

function isShareGPTExample(value: unknown): value is ShareGPTExample {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as ShareGPTExample).conversations)
  );
}

function isPromptCompletionExample(value: unknown): value is PromptCompletionExample {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PromptCompletionExample).prompt === 'string' &&
    typeof (value as PromptCompletionExample).completion === 'string'
  );
}

// HuggingFace Provider Handler (Stub)
async function handleHuggingFaceProvider(): Promise<NextResponse> {
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
  supabase: SupabaseClient,
  user: User,
  executionRecord: ExecutionRecord,
  config: TrainingConfigRow,
  method: TrainingMethod
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
    
    const trainingConfig: TrainingConfigJSON = config.config_json || {};
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

    if (datasetsError) {
      console.error('[TrainingExecute] Dataset fetch error:', datasetsError);
      return NextResponse.json(
        {
          error: 'Failed to fetch datasets',
          details: datasetsError.message,
        },
        { status: 500 }
      );
    }

    const datasets = ((configDatasets || []) as unknown as ConfigDatasetRow[])
      .map((cd) => cd.training_datasets)
      .filter((d): d is TrainingDatasetRecord => d !== null);

    if (datasets.length === 0) {
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
      .single<ProviderSettingsRow>();

    const providerConfig: LocalProviderConfig = providerSettings?.value || {
      type: 'local',
      base_url: process.env.NEXT_PUBLIC_TRAINING_SERVER_URL || 'http://localhost:8000',
      timeout_ms: parseInt(process.env.TRAINING_PROVIDER_TIMEOUT_MS || '5000', 10)
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
