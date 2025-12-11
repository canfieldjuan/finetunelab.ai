/**
 * DAG Orchestrator Usage Examples
 * 
 * Shows how to use the DAG orchestrator for various training pipelines
 */

import DAGOrchestrator, { JobConfig, JobType } from './dag-orchestrator';
import { defaultHandlers } from './job-handlers';
import { ENDPOINTS } from '@/lib/config/endpoints';

// ============================================================================
// Example 1: Simple Training Pipeline
// ============================================================================

export async function runSimpleTrainingPipeline() {
  // Initialize orchestrator
  const orchestrator = new DAGOrchestrator(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Register handlers
  orchestrator.registerHandler('training', defaultHandlers.training);
  orchestrator.registerHandler('validation', defaultHandlers.validation);

  // Define jobs
  const jobs: JobConfig[] = [
    {
      id: 'train_model',
      name: 'Train ECG Segmentation Model',
      type: 'training',
      dependsOn: [],
      config: {
        modelType: 'unet',
        dataset: 'ecg_synthetic_50k',
        epochs: 20,
        batchSize: 32,
        learningRate: 0.001,
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
      retryConfig: {
        maxRetries: 2,
        retryDelayMs: 5000,
      },
      timeoutMs: 3600000, // 1 hour
    },
    {
      id: 'validate_model',
      name: 'Validate Model',
      type: 'validation',
      dependsOn: ['train_model'],
      config: {
        validationDataset: 'ecg_validation',
        metrics: ['accuracy', 'dice_coefficient', 'iou'],
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
  ];

  // Execute with progress tracking
  const execution = await orchestrator.execute('Simple Training Pipeline', jobs, {
    parallelism: 2,
    onJobComplete: (jobId, output) => {
      console.log(`✅ Job ${jobId} completed:`, output);
    },
    onJobFail: (jobId, error) => {
      console.error(`❌ Job ${jobId} failed:`, error);
    },
    onProgress: (completed, total) => {
      console.log(`Progress: ${completed}/${total} jobs completed`);
    },
  });

  return execution;
}

// ============================================================================
// Example 2: Multi-Model Pipeline (ECG Project)
// ============================================================================

export async function runECGMultiModelPipeline() {
  const orchestrator = new DAGOrchestrator(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Register all handlers
  Object.entries(defaultHandlers).forEach(([type, handler]) => {
    return orchestrator.registerHandler(type as unknown as JobType, handler);
  });

  // Define complex pipeline
  const jobs: JobConfig[] = [
    // Step 1: Preprocess data
    {
      id: 'preprocess_data',
      name: 'Preprocess ECG Images',
      type: 'preprocessing',
      dependsOn: [],
      config: {
        inputPath: 's3://datasets/ecg-raw',
        outputPath: 's3://datasets/ecg-processed',
        operations: ['denoise', 'normalize', 'augment', 'split'],
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },

    // Step 2: Train three models in parallel
    {
      id: 'train_segmentation',
      name: 'Train Segmentation Model (U-Net)',
      type: 'training',
      dependsOn: ['preprocess_data'],
      config: {
        modelType: 'unet',
        dataset: 'ecg_processed',
        epochs: 30,
        batchSize: 16,
        learningRate: 0.0001,
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
      retryConfig: { maxRetries: 2, retryDelayMs: 10000 },
    },
    {
      id: 'train_detection',
      name: 'Train Detection Model (YOLO)',
      type: 'training',
      dependsOn: ['preprocess_data'],
      config: {
        modelType: 'yolov8',
        dataset: 'ecg_processed',
        epochs: 50,
        batchSize: 32,
        learningRate: 0.001,
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
      retryConfig: { maxRetries: 2, retryDelayMs: 10000 },
    },
    {
      id: 'train_vectorization',
      name: 'Train Vectorization Model (DETR)',
      type: 'training',
      dependsOn: ['preprocess_data'],
      config: {
        modelType: 'detr',
        dataset: 'ecg_processed',
        epochs: 40,
        batchSize: 8,
        learningRate: 0.00001,
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
      retryConfig: { maxRetries: 2, retryDelayMs: 10000 },
    },

    // Step 3: Validate all models in parallel
    {
      id: 'validate_segmentation',
      name: 'Validate Segmentation Model',
      type: 'validation',
      dependsOn: ['train_segmentation'],
      config: {
        validationDataset: 'ecg_validation',
        metrics: ['dice_coefficient', 'iou', 'pixel_accuracy'],
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'validate_detection',
      name: 'Validate Detection Model',
      type: 'validation',
      dependsOn: ['train_detection'],
      config: {
        validationDataset: 'ecg_validation',
        metrics: ['map', 'precision', 'recall'],
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'validate_vectorization',
      name: 'Validate Vectorization Model',
      type: 'validation',
      dependsOn: ['train_vectorization'],
      config: {
        validationDataset: 'ecg_validation',
        metrics: ['mae', 'mse', 'signal_quality'],
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },

    // Step 4: Deploy to staging after all validations pass
    {
      id: 'deploy_staging',
      name: 'Deploy Pipeline to Staging',
      type: 'deployment',
      dependsOn: ['validate_segmentation', 'validate_detection', 'validate_vectorization'],
      config: {
        deploymentTarget: 'staging',
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
  ];

  // Execute pipeline
  const execution = await orchestrator.execute('ECG Multi-Model Pipeline', jobs, {
    parallelism: 3, // Run up to 3 jobs in parallel
    onJobComplete: (jobId, output) => {
      console.log(`✅ ${jobId} completed:`, output);
    },
    onJobFail: (jobId, error) => {
      console.error(`❌ ${jobId} failed:`, error);
    },
    onProgress: (completed, total) => {
      const percentage = Math.round((completed / total) * 100);
      console.log(`Progress: ${percentage}% (${completed}/${total})`);
    },
  });

  return execution;
}

// ============================================================================
// Example 3: A/B Testing Pipeline
// ============================================================================

export async function runABTestingPipeline() {
  const orchestrator = new DAGOrchestrator(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  Object.entries(defaultHandlers).forEach(([type, handler]) => {
    orchestrator.registerHandler(type as JobType, handler);
  });

  const jobs: JobConfig[] = [
    // Preprocess once
    {
      id: 'preprocess',
      name: 'Preprocess Data',
      type: 'preprocessing',
      dependsOn: [],
      config: {
        inputPath: 's3://datasets/raw',
        outputPath: 's3://datasets/processed',
        operations: ['normalize', 'split'],
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },

    // Train variant A
    {
      id: 'train_variant_a',
      name: 'Train Variant A (High LR)',
      type: 'training',
      dependsOn: ['preprocess'],
      config: {
        modelType: 'transformer',
        dataset: 'processed',
        epochs: 20,
        batchSize: 32,
        learningRate: 0.001, // High learning rate
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },

    // Train variant B
    {
      id: 'train_variant_b',
      name: 'Train Variant B (Low LR)',
      type: 'training',
      dependsOn: ['preprocess'],
      config: {
        modelType: 'transformer',
        dataset: 'processed',
        epochs: 20,
        batchSize: 32,
        learningRate: 0.0001, // Low learning rate
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },

    // Validate both
    {
      id: 'validate_a',
      name: 'Validate Variant A',
      type: 'validation',
      dependsOn: ['train_variant_a'],
      config: {
        validationDataset: 'validation',
        metrics: ['accuracy', 'f1'],
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'validate_b',
      name: 'Validate Variant B',
      type: 'validation',
      dependsOn: ['train_variant_b'],
      config: {
        validationDataset: 'validation',
        metrics: ['accuracy', 'f1'],
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
  ];

  const execution = await orchestrator.execute('A/B Testing Pipeline', jobs, {
    parallelism: 2,
  });

  // Compare results
  const outputA = execution.jobs.get('validate_a')?.output as { metrics?: { accuracy: number } } | undefined;
  const outputB = execution.jobs.get('validate_b')?.output as { metrics?: { accuracy: number } } | undefined;
  const variantA = outputA?.metrics;
  const variantB = outputB?.metrics;

  console.log('=== A/B Test Results ===');
  console.log('Variant A:', variantA);
  console.log('Variant B:', variantB);

  if (variantA && variantB) {
    const winner = variantA.accuracy > variantB.accuracy ? 'A' : 'B';
    console.log(`Winner: Variant ${winner}`);
  }

  return execution;
}

// ============================================================================
// Example 4: Integration with Next.js API Route
// ============================================================================

// File: app/api/training/pipeline/route.ts
export async function POST(request: Request) {
  try {
    const { pipelineType, config: _config } = await request.json(); // eslint-disable-line @typescript-eslint/no-unused-vars

    let execution;
    switch (pipelineType) {
      case 'simple':
        execution = await runSimpleTrainingPipeline();
        break;
      case 'ecg-multi-model':
        execution = await runECGMultiModelPipeline();
        break;
      case 'ab-testing':
        execution = await runABTestingPipeline();
        break;
      default:
        throw new Error(`Unknown pipeline type: ${pipelineType}`);
    }

    return Response.json({
      success: true,
      executionId: execution.id,
      status: execution.status,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ============================================================================
// Example 5: Real-time Progress Streaming (SSE)
// ============================================================================

// File: app/api/training/stream/[executionId]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { executionId: string } }
) {
  const orchestrator = new DAGOrchestrator(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const execution = orchestrator.getExecution(params.executionId);

  if (!execution) {
    return Response.json({ error: 'Execution not found' }, { status: 404 });
  }

  // Create SSE stream
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send updates every second
  const interval = setInterval(() => {
    const currentExecution = orchestrator.getExecution(params.executionId);
    if (!currentExecution) {
      clearInterval(interval);
      writer.close();
      return;
    }

    const data = JSON.stringify({
      status: currentExecution.status,
      jobs: Array.from(currentExecution.jobs.entries()).map(([id, job]) => ({
        id,
        status: job.status,
        progress: (job as unknown as Record<string, unknown>).progress,
        logs: job.logs.slice(-5), // Last 5 log entries
      })),
    });

    writer.write(encoder.encode(`data: ${data}\n\n`));

    if (currentExecution.status === 'completed' || currentExecution.status === 'failed') {
      clearInterval(interval);
      writer.close();
    }
  }, 1000);

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
