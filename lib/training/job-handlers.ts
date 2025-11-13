/**
 * Job Handlers for Training DAG
 * Updated: 2025-10-26
 * Now integrated with Training Execution API and LocalTrainingProvider
 */

import { JobHandler, JobConfig, JobContext } from './dag-orchestrator';
import type {
  TrainingExecutionRequest,
  TrainingExecutionResponse,
  TrainingStatusResponse,
} from './execution-types';
import { LocalTrainingProvider } from '@/lib/services/training-providers/local.provider';
import { getArtifactStore } from '@/lib/services/artifact-store';
import { getBaselineManager } from '@/lib/services/baseline-manager';
import path from 'path';

// ============================================================================
// Helper: Poll Local Training Server Status
// ============================================================================

async function pollLocalTrainingStatus(
  provider: LocalTrainingProvider,
  jobId: string,
  context: JobContext
): Promise<{ success: boolean; error?: string; output?: unknown }> {
  console.log('[DAG-LocalPoll] Starting status polling for job:', jobId);
  context.log(`Monitoring local training job: ${jobId}`);

  const maxAttempts = 360; // 30 minutes with 5-second intervals
  const pollInterval = 5000; // 5 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    try {
      // Try to get status from backend memory first (for active jobs)
      let status = await provider.getStatus(jobId);

      // If backend returns null (job removed from memory), query database directly
      if (!status) {
        console.log('[DAG-LocalPoll] Job not in backend memory, querying database...');

        try {
          // Query Supabase directly using service role key
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
          const supabase = createClient(supabaseUrl, supabaseKey);

          const { data: job, error: jobError } = await supabase
            .from('local_training_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

          if (jobError || !job) {
            console.error('[DAG-LocalPoll] Database query failed:', jobError);
            continue; // Retry on error
          }

          // Transform database record to TrainingJobStatus format
          status = {
            job_id: job.id,
            status: job.status,
            progress: 0,
            current_epoch: 0,
            total_epochs: job.total_epochs || 0,
            current_step: 0,
            total_steps: job.total_steps || 0,
            error: job.status === 'failed' ? (job.config?.error || 'Training failed') : undefined,
            started_at: job.started_at,
            completed_at: job.completed_at,
            updated_at: job.updated_at,
            batch_size: undefined,
            gradient_accumulation_steps: undefined,
          };

          console.log('[DAG-LocalPoll] Retrieved status from database:', {
            jobId: status.job_id,
            status: status.status,
          });
        } catch (dbError) {
          console.error('[DAG-LocalPoll] Database fallback failed:', dbError);
          continue; // Retry on error
        }
      }

      if (!status) {
        console.error('[DAG-LocalPoll] Status check failed: null response after all attempts');
        continue; // Retry on error
      }

      console.log('[DAG-LocalPoll] Status update:', {
        attempt,
        status: status.status,
        progress: status.progress,
      });

      context.log(`Status: ${status.status} ${status.progress ? `(${status.progress}%)` : ''}`);

      // Check if terminal state
      if (status.status === 'completed') {
        console.log('[DAG-LocalPoll] Training completed successfully');
        context.log('Training completed successfully!');
        return {
          success: true,
          output: status,
        };
      }

      if (status.status === 'failed') {
        console.log('[DAG-LocalPoll] Training failed:', status.error);
        context.log(`Training failed: ${status.error || 'Unknown error'}`);
        return {
          success: false,
          error: status.error || 'Training failed',
        };
      }

    } catch (error) {
      console.error('[DAG-LocalPoll] Error checking status:', error);
      context.log(`Error checking status: ${error instanceof Error ? error.message : 'Unknown'}`);
      // Continue polling on error
    }
  }

  // Timeout
  console.error('[DAG-LocalPoll] Polling timeout after', maxAttempts, 'attempts');
  context.log('Training timeout after 30 minutes');
  throw new Error('Training execution timeout after 30 minutes');
}

// ============================================================================
// Helper: Poll Execution Status
// ============================================================================

async function pollExecutionStatus(
  baseUrl: string,
  executionId: string,
  context: JobContext
): Promise<TrainingStatusResponse> {
  console.log('[DAG-Poll] Starting status polling for:', executionId);

  const maxAttempts = 360; // 30 minutes with 5-second intervals
  const pollInterval = 5000; // 5 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const statusUrl = `${baseUrl}/api/training/execute/${executionId}/status`;

    try {
      const response = await fetch(statusUrl);

      if (!response.ok) {
        console.error('[DAG-Poll] Status API error:', response.statusText);
        continue; // Retry on error
      }

      const status: TrainingStatusResponse = await response.json();

      console.log('[DAG-Poll] Status update:', {
        attempt,
        status: status.status,
        progress: status.progress,
      });

      // Update progress in DAG
      if (status.progress !== undefined) {
        await context.updateProgress(status.progress);
        context.log(`Progress: ${status.progress}%`);
      }

      // Check if terminal state
      if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
        console.log('[DAG-Poll] Terminal state reached:', status.status);
        return status;
      }

    } catch (error) {
      console.error('[DAG-Poll] Error fetching status:', error);
      // Continue polling on error
    }
  }

  // Timeout
  console.error('[DAG-Poll] Polling timeout after', maxAttempts, 'attempts');
  throw new Error('Training execution timeout after 30 minutes');
}

// ============================================================================
// ID Resolution Helper - Resolves model and dataset IDs to actual data
// ============================================================================

/**
 * Resolves model and dataset IDs to their full database records
 * Used by DAG training nodes to convert UUID references to actual data
 */
async function resolveTrainingData(
  modelId: string | undefined,
  datasetId: string | undefined
): Promise<{ model: ModelRecord; dataset: DatasetRecord } | null> {
  console.log('[DAG-ResolveData] Resolving training data:', { modelId, datasetId });

  if (!modelId || !datasetId) {
    console.error('[DAG-ResolveData] Missing modelId or datasetId');
    return null;
  }

  try {
    // Create Supabase client with service role key (same as DAG orchestrator)
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch model
    const { data: model, error: modelError } = await supabase
      .from('llm_models')
      .select('id, name, base_model, provider, training_method, lora_config')
      .eq('id', modelId)
      .single();

    if (modelError) {
      console.error('[DAG-ResolveData] Model fetch error:', modelError);
      return null;
    }

    // Fetch dataset
    const { data: dataset, error: datasetError } = await supabase
      .from('training_datasets')
      .select('id, name, storage_path, format, total_examples')
      .eq('id', datasetId)
      .single();

    if (datasetError) {
      console.error('[DAG-ResolveData] Dataset fetch error:', datasetError);
      return null;
    }

    console.log('[DAG-ResolveData] Resolved model:', model.name);
    console.log('[DAG-ResolveData] Resolved dataset:', dataset.name);

    return { model, dataset };
  } catch (error) {
    console.error('[DAG-ResolveData] Resolution error:', error);
    return null;
  }
}

// Type definitions for resolved data
type ModelRecord = {
  id: string;
  name: string;
  base_model: string | null;
  provider: string;
  training_method: string | null;
  lora_config: Record<string, unknown> | null;
};

type DatasetRecord = {
  id: string;
  name: string;
  storage_path: string;
  format: string;
  total_examples: number;
};

// ============================================================================
// Helper: Resolve Training Config from Database
// ============================================================================

async function resolveTrainingConfig(
  trainingConfigId: string | undefined
): Promise<{ config: TrainingConfigRecord } | null> {
  console.log('[DAG-ResolveConfig] Resolving training config:', trainingConfigId);

  if (!trainingConfigId) {
    console.log('[DAG-ResolveConfig] No trainingConfigId provided');
    return null;
  }

  try {
    // Create Supabase client with service role key
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch training config
    const { data: config, error: configError } = await supabase
      .from('training_configs')
      .select('id, name, description, config_json')
      .eq('id', trainingConfigId)
      .single();

    if (configError) {
      console.error('[DAG-ResolveConfig] Config fetch error:', configError);
      return null;
    }

    if (!config) {
      console.error('[DAG-ResolveConfig] Config not found');
      return null;
    }

    console.log('[DAG-ResolveConfig] Resolved config:', config.name);

    return { config };
  } catch (error) {
    console.error('[DAG-ResolveConfig] Resolution error:', error);
    return null;
  }
}

// Type definition for training config record
type TrainingConfigRecord = {
  id: string;
  name: string;
  description: string | null;
  config_json: {
    training?: {
      method?: string;
      num_epochs?: number;
      batch_size?: number;
      learning_rate?: number;
      [key: string]: unknown;
    };
    method?: string;
    num_epochs?: number;
    batch_size?: number;
    learning_rate?: number;
    [key: string]: unknown;
  };
};

// ============================================================================
// Training Job Handler - Updated to use Execution API
// ============================================================================

export const trainingJobHandler: JobHandler = async (config: JobConfig, context: JobContext) => {
  console.log('[DAG-TrainingHandler] Starting training job');
  context.log('Starting training job via execution API...');

  // Extract and validate config parameters
  const publicId = config.config.publicId as string;
  const method = (config.config.method as string) || 'sft';
  const provider = (config.config.provider as string) || 'colab';
  const openai_model = config.config.openai_model as string | undefined;
  const openai_n_epochs = config.config.openai_n_epochs as number | undefined;
  const callback_url = config.config.callback_url as string | undefined;

  console.log('[DAG-TrainingHandler] Config:', {
    publicId,
    method,
    provider,
    openai_model,
  });

  // Validate required parameters
  if (!publicId) {
    const error = 'Missing required parameter: publicId (training config public ID)';
    console.error('[DAG-TrainingHandler] Error:', error);
    context.log(`ERROR: ${error}`);
    throw new Error(error);
  }

  if (!['sft', 'dpo', 'rlhf'].includes(method)) {
    const error = `Invalid method: ${method}. Must be sft, dpo, or rlhf`;
    console.error('[DAG-TrainingHandler] Error:', error);
    context.log(`ERROR: ${error}`);
    throw new Error(error);
  }

  if (!['colab', 'huggingface', 'openai', 'local'].includes(provider)) {
    const error = `Invalid provider: ${provider}. Must be colab, huggingface, openai, or local`;
    console.error('[DAG-TrainingHandler] Error:', error);
    context.log(`ERROR: ${error}`);
    throw new Error(error);
  }

  try {
    // SPECIAL HANDLING: Local Provider - Use LocalTrainingProvider directly
    if (provider === 'local') {
      console.log('[DAG-TrainingHandler] Using LocalTrainingProvider for local execution');
      context.log('Starting local training via training server...');

      // Initialize LocalTrainingProvider
      const localProvider = new LocalTrainingProvider({
        type: 'local',
        base_url: process.env.LOCAL_TRAINING_SERVER_URL || 'http://localhost:8000',
        timeout_ms: 5000,
      });

      // Test connection first
      const connectionTest = await localProvider.validateConnection();
      if (!connectionTest.success) {
        const error = `Training server not available: ${connectionTest.error}`;
        console.error('[DAG-TrainingHandler] Connection failed:', error);
        context.log(`ERROR: ${error}`);
        throw new Error(error);
      }

      context.log('Training server connection verified');

      // Resolve training config from database if trainingConfigId is provided
      let trainingConfigData: TrainingConfigRecord | null = null;
      let numEpochs: number | undefined;
      let batchSize: number | undefined;
      let learningRate: number | undefined;
      let trainingMethod: string | undefined;

      if (config.config.trainingConfigId) {
        console.log('[DAG-TrainingHandler] Resolving training config from database');
        context.log('Resolving training configuration...');

        const resolvedConfig = await resolveTrainingConfig(
          config.config.trainingConfigId as string
        );

        if (!resolvedConfig) {
          const error = 'Failed to resolve training config from provided ID';
          console.error('[DAG-TrainingHandler] Config resolution failed');
          context.log(`ERROR: ${error}`);
          throw new Error(error);
        }

        trainingConfigData = resolvedConfig.config;

        // Extract hyperparameters from config_json
        const configJson = trainingConfigData.config_json;
        numEpochs = configJson.training?.num_epochs || configJson.num_epochs;
        batchSize = configJson.training?.batch_size || configJson.batch_size;
        learningRate = configJson.training?.learning_rate || configJson.learning_rate;
        trainingMethod = configJson.training?.method || configJson.method;

        console.log('[DAG-TrainingHandler] Resolved training config:', {
          name: trainingConfigData.name,
          method: trainingMethod,
          epochs: numEpochs,
          batchSize,
          learningRate,
        });

        context.log(`Using training config: ${trainingConfigData.name}`);
        context.log(`Method: ${trainingMethod}, Epochs: ${numEpochs}, Batch: ${batchSize}`);
      } else {
        console.log('[DAG-TrainingHandler] No trainingConfigId provided, using defaults');
        context.log('Using default training parameters');
      }

      // Resolve model and dataset IDs if using new dropdown approach
      let modelName = config.config.modelType as string | undefined;
      let datasetPath = config.config.dataset as string | undefined;
      let loraConfig = config.config.loraConfig as Record<string, unknown> | undefined;

      if (config.config.modelId && config.config.datasetId) {
        console.log('[DAG-TrainingHandler] Resolving model and dataset from IDs');
        context.log('Resolving training configuration...');
        
        const resolved = await resolveTrainingData(
          config.config.modelId as string,
          config.config.datasetId as string
        );

        if (!resolved) {
          const error = 'Failed to resolve model or dataset from provided IDs';
          console.error('[DAG-TrainingHandler] Resolution failed');
          context.log(`ERROR: ${error}`);
          throw new Error(error);
        }

        // Use resolved data
        modelName = resolved.model.base_model || resolved.model.name;
        datasetPath = resolved.dataset.storage_path;
        loraConfig = resolved.model.lora_config || undefined;

        console.log('[DAG-TrainingHandler] Resolved:', {
          model: resolved.model.name,
          dataset: resolved.dataset.name,
          modelName,
          datasetPath,
        });
        context.log(`Using model: ${resolved.model.name} (${modelName})`);
        context.log(`Using dataset: ${resolved.dataset.name}`);
      } else {
        console.log('[DAG-TrainingHandler] Using legacy text-based config');
        context.log('Using manually specified model and dataset');
      }

      // Build training request with resolved config data
      const trainingRequest: {
        config_id: string;
        dataset_id?: string;
        model_name?: string;
        dataset_path?: string;
        lora_config?: Record<string, unknown>;
        name: string;
        // Hyperparameters from training config (if resolved)
        num_epochs?: number;
        batch_size?: number;
        learning_rate?: number;
        method?: string;
      } = {
        config_id: publicId,
        dataset_id: config.config.dataset_id as string,
        model_name: modelName,
        dataset_path: datasetPath,
        lora_config: loraConfig,
        name: `DAG Training - ${config.name}`,
      };

      // Add hyperparameters if we resolved a training config
      if (trainingConfigData) {
        trainingRequest.num_epochs = numEpochs;
        trainingRequest.batch_size = batchSize;
        trainingRequest.learning_rate = learningRate;
        trainingRequest.method = trainingMethod;
      }

      console.log('[DAG-TrainingHandler] Submitting job to training server:', trainingRequest);
      context.log(`Submitting training job: ${trainingRequest.name}`);

      const jobResult = await localProvider.executeTraining(trainingRequest);

      if (!jobResult.success) {
        const error = `Failed to submit training job: ${jobResult.error}`;
        console.error('[DAG-TrainingHandler] Submit failed:', error);
        context.log(`ERROR: ${error}`);
        throw new Error(error);
      }

      const jobId = jobResult.job_id!;
      console.log('[DAG-TrainingHandler] Job submitted. Job ID:', jobId);
      context.log(`Job ID: ${jobId}`);
      context.log('Monitoring training progress...');

      // Poll for completion using LocalTrainingProvider
      const finalResult = await pollLocalTrainingStatus(localProvider, jobId, context);

      if (!finalResult.success) {
        throw new Error(finalResult.error || 'Training failed');
      }

      context.log('Local training completed successfully!');

      // Register training artifacts
      try {
        console.log('[DAG-TrainingHandler] Registering training artifacts');
        context.log('Registering training artifacts...');

        const artifactStore = getArtifactStore();
        const outputDir = process.env.TRAINING_OUTPUT_DIR || 'lib/training/logs';
        const modelPath = path.join(process.cwd(), outputDir, `job_${jobId}`);

        console.log('[DAG-TrainingHandler] Model path:', modelPath);
        context.log(`Model path: ${modelPath}`);

        const artifacts = await artifactStore.registerDirectory(
          context.executionId,
          config.id,
          modelPath,
          'model',
          {
            job_id: jobId,
            model_name: trainingRequest.model_name,
            training_method: trainingRequest.method,
          }
        );

        console.log('[DAG-TrainingHandler] Registered', artifacts.length, 'artifacts');
        context.log(`Registered ${artifacts.length} training artifacts`);
      } catch (error) {
        console.error('[DAG-TrainingHandler] Artifact registration failed:', error);
        context.log(`Warning: Artifact registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      return {
        success: true,
        job_id: jobId,
        provider: 'local',
        status: 'completed',
        output: finalResult.output,
        message: 'Local training completed successfully',
      };
    }

    // For non-local providers, call execution API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const executeUrl = `${baseUrl}/api/training/execute`;

    console.log('[DAG-TrainingHandler] Calling execution API:', executeUrl);
    context.log(`Calling execution API: ${provider} provider`);

    const requestBody: TrainingExecutionRequest = {
      public_id: publicId,
      method: method as 'sft' | 'dpo' | 'rlhf' | 'orpo',
      provider: provider as 'colab' | 'huggingface' | 'openai' | 'local',
      callback_url,
      openai_model,
      openai_n_epochs,
    };

    const response = await fetch(executeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      const error = `Execution API error: ${errorData.error || response.statusText}`;
      console.error('[DAG-TrainingHandler] API error:', errorData);
      context.log(`ERROR: ${error}`);
      throw new Error(error);
    }

    const result: TrainingExecutionResponse = await response.json();
    console.log('[DAG-TrainingHandler] Execution started:', result.execution_id);
    context.log(`Execution started: ${result.execution_id}`);
    context.log(`Provider: ${result.provider}`);
    context.log(`Status: ${result.status}`);

    // Handle Colab provider - return URL for manual execution
    if (provider === 'colab') {
      console.log('[DAG-TrainingHandler] Colab URL:', result.colab_url);
      context.log(`Colab URL: ${result.colab_url}`);
      context.log('Open Colab link to start training manually');

      return {
        success: true,
        execution_id: result.execution_id,
        provider: 'colab',
        colab_url: result.colab_url,
        message: 'Open Colab notebook to start training',
      };
    }

    // For other providers, poll for completion
    console.log('[DAG-TrainingHandler] Polling for completion...');
    context.log('Polling for training completion...');

    const finalStatus = await pollExecutionStatus(
      baseUrl,
      result.execution_id,
      context
    );

    console.log('[DAG-TrainingHandler] Training completed:', finalStatus.status);
    context.log(`Training ${finalStatus.status}`);

    if (finalStatus.status === 'failed') {
      throw new Error(finalStatus.error || 'Training failed');
    }

    return {
      success: true,
      execution_id: result.execution_id,
      provider: result.provider,
      status: finalStatus.status,
      result: finalStatus.result,
      message: 'Training completed successfully',
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DAG-TrainingHandler] Error:', errorMessage);
    context.log(`Training failed: ${errorMessage}`);
    throw error;
  }
};

// ============================================================================
// Preprocessing Job Handler
// ============================================================================

export const preprocessingJobHandler: JobHandler = async (
  config: JobConfig,
  context: JobContext
) => {
  context.log('Starting preprocessing job...');

  const {
    inputPath,
    outputPath,
    operations = [],
    apiEndpoint,
  } = config.config;

  try {
    const response = await fetch(`${apiEndpoint}/preprocess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input_path: inputPath,
        output_path: outputPath,
        operations, // e.g., ['normalize', 'augment', 'split']
      }),
    });

    if (!response.ok) {
      throw new Error(`Preprocessing API error: ${response.statusText}`);
    }

    const result = await response.json();
    context.log(`Preprocessing completed: ${result.records_processed} records processed`);

    return {
      outputPath: result.output_path,
      stats: result.stats,
      recordsProcessed: result.records_processed,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.log(`Preprocessing failed: ${errorMessage}`);
    throw error;
  }
};

// ============================================================================
// Validation Job Handler
// ============================================================================

export const validationJobHandler: JobHandler = async (
  config: JobConfig,
  context: JobContext
) => {
  context.log('Starting validation job...');

  const {
    validationDataset,
    metrics = ['accuracy', 'f1', 'precision', 'recall'],
    apiEndpoint,
    modelName,
    modelVersion,
    checkBaselines = true,
  } = config.config;

  // Get model path from previous training job if specified
  const trainingJobId = config.dependsOn.find(id => id.startsWith('train_'));
  if (trainingJobId) {
    const trainingOutput = context.getJobOutput(trainingJobId) as { modelPath?: string } | null;
    if (trainingOutput?.modelPath) {
      config.config.modelPath = trainingOutput.modelPath;
    }
  }

  try {
    const response = await fetch(`${apiEndpoint}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_path: config.config.modelPath,
        validation_dataset: validationDataset,
        metrics,
      }),
    });

    if (!response.ok) {
      throw new Error(`Validation API error: ${response.statusText}`);
    }

    const result = await response.json();

    // Log metrics
    for (const [metricName, value] of Object.entries(result.metrics)) {
      context.log(`${metricName}: ${value}`);
    }

    // Check baselines if enabled and model name provided
    if (checkBaselines && modelName) {
      context.log('Checking metrics against baselines...');

      try {
        const baselineManager = getBaselineManager();
        const validationResult = await baselineManager.validate({
          modelName: String(modelName),
          modelVersion: modelVersion ? String(modelVersion) : undefined,
          metrics: result.metrics,
          executionId: context.executionId,
          jobId: config.id,
        });

        context.log(`Baseline validation: ${validationResult.status}`);

        // Log failures
        if (validationResult.failures.length > 0) {
          context.log('FAILURES:');
          validationResult.failures.forEach(failure => context.log(`  ✗ ${failure}`));
        }

        // Log warnings
        if (validationResult.warnings.length > 0) {
          context.log('WARNINGS:');
          validationResult.warnings.forEach(warning => context.log(`  ⚠ ${warning}`));
        }

        // Log successes
        const successes = validationResult.baselineComparisons.filter(c => c.passed);
        if (successes.length > 0) {
          context.log('PASSED:');
          successes.forEach(comparison => context.log(`  ✓ ${comparison.message}`));
        }

        // Fail the job if critical baseline checks failed
        if (validationResult.status === 'failed') {
          throw new Error(`Baseline validation failed:\n${validationResult.failures.join('\n')}`);
        }

        return {
          metrics: result.metrics,
          confusionMatrix: result.confusion_matrix,
          reportPath: result.report_path,
          baselineValidation: {
            status: validationResult.status,
            failures: validationResult.failures,
            warnings: validationResult.warnings,
            comparisons: validationResult.baselineComparisons,
          },
        };
      } catch (baselineError) {
        // If baseline checking fails, log but don't fail the entire job
        const errorMessage = baselineError instanceof Error ? baselineError.message : 'Unknown error';
        context.log(`Baseline check error: ${errorMessage}`);

        // Re-throw if it's a validation failure (not a system error)
        if (errorMessage.includes('Baseline validation failed')) {
          throw baselineError;
        }
      }
    }

    return {
      metrics: result.metrics,
      confusionMatrix: result.confusion_matrix,
      reportPath: result.report_path,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.log(`Validation failed: ${errorMessage}`);
    throw error;
  }
};

// ============================================================================
// Deployment Job Handler
// ============================================================================

export const deploymentJobHandler: JobHandler = async (
  config: JobConfig,
  context: JobContext
) => {
  context.log('Starting deployment job...');

  const {
    deploymentTarget = 'staging', // 'staging' or 'production'
    apiEndpoint,
  } = config.config;

  // Get model path from previous job
  const trainingJobId = config.dependsOn.find(id => id.startsWith('train_'));
  if (trainingJobId) {
    const trainingOutput = context.getJobOutput(trainingJobId) as { modelPath?: string } | null;
    if (trainingOutput?.modelPath) {
      config.config.modelPath = trainingOutput.modelPath;
    }
  }

  try {
    const response = await fetch(`${apiEndpoint}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_path: config.config.modelPath,
        target: deploymentTarget,
      }),
    });

    if (!response.ok) {
      throw new Error(`Deployment API error: ${response.statusText}`);
    }

    const result = await response.json();
    context.log(`Model deployed to ${deploymentTarget}: ${result.endpoint_url}`);

    return {
      endpointUrl: result.endpoint_url,
      deploymentId: result.deployment_id,
      version: result.version,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.log(`Deployment failed: ${errorMessage}`);
    throw error;
  }
};

// ============================================================================
// Regression Gate Job Handler
// ============================================================================

/**
 * Regression Gate Handler - Validates model metrics against baseline
 * 
 * Phase 2 Implementation: Uses manual currentMetrics from config
 * Phase 3 Enhancement: Will add automated model inference
 * 
 * @param config - Job configuration with RegressionGateConfig
 * @param context - Job execution context
 * @returns Validation result with pass/fail status
 */
export const regressionGateJobHandler: JobHandler = async (
  config: JobConfig,
  context: JobContext
) => {
  console.log('[DAG-RegressionGate] Starting regression gate validation');
  context.log('Starting regression gate validation...');

  // Type assertion for config (using unknown for safe casting)
  interface RegressionGateConfigType {
    baselineId: string;
    currentMetrics?: Record<string, number>;
    modelPath?: string;
    testDatasetId?: string;
    failureThreshold?: number;
    requiredMetrics?: string[];
    blockOnFailure?: boolean;
  }
  const gateConfig = config.config as unknown as RegressionGateConfigType;

  // Extract configuration
  const {
    baselineId,
    currentMetrics,
    modelPath,
    testDatasetId,
    failureThreshold = 0.05,
    requiredMetrics = [],
    blockOnFailure = true,
  } = gateConfig;

  console.log('[DAG-RegressionGate] Configuration:', {
    baselineId,
    metricsProvided: Object.keys(currentMetrics || {}),
    modelPath,
    testDatasetId,
    failureThreshold,
    requiredMetrics,
    blockOnFailure,
  });

  // Validate required parameters
  if (!baselineId) {
    const error = 'Missing required parameter: baselineId';
    console.error('[DAG-RegressionGate] Error:', error);
    context.log(`ERROR: ${error}`);
    throw new Error(error);
  }

  // Determine metrics source: manual or automated
  let metricsToUse: Record<string, number> | null = currentMetrics || null;

  // If modelPath and testDatasetId provided, fetch metrics from validation endpoint
  if (modelPath && testDatasetId && !currentMetrics) {
    console.log('[DAG-RegressionGate] Automated metric computation requested');
    context.log('Computing metrics automatically via model inference...');
    
    try {
      const metricsToCompute = requiredMetrics.length > 0 
        ? requiredMetrics 
        : ['accuracy', 'f1', 'precision', 'recall'];
      
      console.log('[DAG-RegressionGate] Calling validation endpoint:', {
        modelPath,
        testDatasetId,
        metricsToCompute,
      });

      const validationResponse = await fetch('http://localhost:8001/api/training/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_path: modelPath,
          test_dataset_id: testDatasetId,
          metrics_to_compute: metricsToCompute,
        }),
      });

      if (!validationResponse.ok) {
        throw new Error(`Validation endpoint returned ${validationResponse.status}`);
      }

      const validationData = await validationResponse.json();
      console.log('[DAG-RegressionGate] Validation endpoint response:', validationData);

      if (validationData.status === 'completed' && validationData.metrics) {
        metricsToUse = validationData.metrics;
        context.log('Metrics computed successfully:');
        Object.entries(metricsToUse!).forEach(([metric, value]) => {
          context.log(`  ${metric}: ${value}`);
        });
      } else {
        throw new Error(validationData.message || 'Validation failed');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DAG-RegressionGate] Automated validation failed:', errorMessage);
      context.log(`WARNING: Automated metric computation failed: ${errorMessage}`);
      context.log('Falling back to manual metrics requirement');
    }
  }

  // Final validation: ensure we have metrics to work with
  if (!metricsToUse || Object.keys(metricsToUse).length === 0) {
    const error = 'No metrics available. Provide either currentMetrics or modelPath+testDatasetId.';
    console.error('[DAG-RegressionGate] Error:', error);
    context.log(`ERROR: ${error}`);
    throw new Error(error);
  }

  try {
    // Get baseline manager
    const baselineManager = getBaselineManager();
    context.log(`Loading baseline: ${baselineId}`);

    // Fetch baseline (single metric baseline)
    const baseline = await baselineManager.getBaseline(baselineId);

    if (!baseline) {
      const error = `Baseline not found: ${baselineId}`;
      console.error('[DAG-RegressionGate] Error:', error);
      context.log(`ERROR: ${error}`);
      throw new Error(error);
    }

    console.log('[DAG-RegressionGate] Baseline loaded:', {
      modelName: baseline.modelName,
      version: baseline.version,
      metricName: baseline.metricName,
      baselineValue: baseline.baselineValue,
    });

    context.log(`Baseline: ${baseline.modelName} v${baseline.version || 'latest'}`);
    context.log(`Baseline metric: ${baseline.metricName} = ${baseline.baselineValue}`);

    // Log current metrics (safe to use metricsToUse here as we validated it exists above)
    const validatedMetrics = metricsToUse!; // Non-null assertion since we checked above
    context.log('Current metrics to compare:');
    Object.entries(validatedMetrics).forEach(([metric, value]) => {
      context.log(`  ${metric}: ${value}`);
    });

    // Validate using BaselineManager
    context.log('Comparing metrics against baseline...');

    const validationResult = await baselineManager.validate({
      modelName: baseline.modelName,
      modelVersion: baseline.version,
      metrics: validatedMetrics,
      executionId: context.executionId,
      jobId: config.id,
    });

    console.log('[DAG-RegressionGate] Validation result:', {
      status: validationResult.status,
      failuresCount: validationResult.failures.length,
      warningsCount: validationResult.warnings.length,
    });

    // Log validation status
    context.log(`Validation status: ${validationResult.status.toUpperCase()}`);

    // Log comparison results
    if (validationResult.baselineComparisons.length > 0) {
      context.log('Metric comparisons:');
      validationResult.baselineComparisons.forEach(comparison => {
        const icon = comparison.passed ? '✓' : '✗';
        context.log(`  ${icon} ${comparison.message}`);
      });
    }

    // Log failures
    if (validationResult.failures.length > 0) {
      context.log('FAILURES:');
      validationResult.failures.forEach(failure => {
        context.log(`  ✗ ${failure}`);
      });
    }

    // Log warnings
    if (validationResult.warnings.length > 0) {
      context.log('WARNINGS:');
      validationResult.warnings.forEach(warning => {
        context.log(`  ⚠ ${warning}`);
      });
    }

    // Check if validation failed
    if (validationResult.status === 'failed') {
      const failureMessage = `Regression detected: ${validationResult.failures.length} metric(s) failed`;
      console.error('[DAG-RegressionGate] Regression detected');

      if (blockOnFailure) {
        context.log('🚫 BLOCKING PIPELINE - Regression gate failed and blockOnFailure=true');
        console.error('[DAG-RegressionGate] Blocking pipeline execution');
        throw new Error(failureMessage);
      } else {
        context.log('⚠️ CONTINUING - Regression detected but blockOnFailure=false');
        console.log('[DAG-RegressionGate] Continuing despite failures (blockOnFailure=false)');
      }
    } else if (validationResult.status === 'warning') {
      context.log('⚠️ PASSED WITH WARNINGS - Some metrics show degradation but within threshold');
    } else {
      context.log('✅ PASSED - All metrics meet baseline requirements');
    }

    // Return validation result
    const result = {
      success: validationResult.status !== 'failed' || !blockOnFailure,
      status: validationResult.status,
      baselineId,
      baselineName: baseline.modelName,
      baselineVersion: baseline.version,
      metricsCompared: Object.keys(validatedMetrics),
      metricsSource: currentMetrics ? 'manual' : 'automated',
      failures: validationResult.failures,
      warnings: validationResult.warnings,
      comparisons: validationResult.baselineComparisons,
      blocked: validationResult.status === 'failed' && blockOnFailure,
    };

    console.log('[DAG-RegressionGate] Job complete:', result);
    return result;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DAG-RegressionGate] Error:', errorMessage);
    context.log(`Regression gate failed: ${errorMessage}`);
    throw error;
  }
};

// ============================================================================
// Export All Handlers
// ============================================================================

export const defaultHandlers = {
  training: trainingJobHandler,
  preprocessing: preprocessingJobHandler,
  validation: validationJobHandler,
  deployment: deploymentJobHandler,
  'regression-gate': regressionGateJobHandler,
};
