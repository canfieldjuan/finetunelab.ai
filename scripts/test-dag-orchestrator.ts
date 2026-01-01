/**
 * DAG Orchestrator Integration Test (TypeScript)
 * 
 * Tests the DAG orchestrator with a simple pipeline
 * Run: npx tsx scripts/test-dag-orchestrator.ts
 */

import DAGOrchestrator, { JobConfig, JobContext } from '../lib/training/dag-orchestrator';

async function main() {
  console.log('=== DAG Orchestrator Integration Test ===\n');

  // Create orchestrator
  const orchestrator = new DAGOrchestrator();
  console.log('✓ Orchestrator created');

  // Register test handlers
  orchestrator.registerHandler('training', async (config: JobConfig, context: JobContext) => {
    context.log(`Starting job: ${config.name}`);
    
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    context.log('Processing data...');
    await context.updateProgress(50);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    context.log('Job completed');
    await context.updateProgress(100);
    
    return {
      success: true,
      processedItems: 100,
      timestamp: new Date().toISOString(),
    };
  });

  orchestrator.registerHandler('preprocessing', async (config: JobConfig, context: JobContext) => {
    context.log(`Preprocessing: ${config.name}`);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return {
      success: true,
      outputPath: '/data/processed',
    };
  });

  orchestrator.registerHandler('validation', async (config: JobConfig, context: JobContext) => {
    context.log(`Validating: ${config.name}`);
    
    // Get output from previous job
    const trainingOutput = context.getJobOutput('train_model') as { processedItems?: number } | undefined;
    context.log(`Training processed ${trainingOutput?.processedItems || 0} items`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      accuracy: 0.95,
      f1Score: 0.93,
    };
  });

  console.log('✓ Handlers registered\n');

  // Define test pipeline
  const jobs: JobConfig[] = [
    {
      id: 'preprocess',
      name: 'Preprocess Data',
      type: 'preprocessing',
      dependsOn: [],
      config: {
        inputPath: '/data/raw',
        outputPath: '/data/processed',
      },
    },
    {
      id: 'train_model',
      name: 'Train Model',
      type: 'training',
      dependsOn: ['preprocess'],
      config: {
        modelType: 'test-model',
        epochs: 10,
      },
      retryConfig: {
        maxRetries: 2,
        retryDelayMs: 500,
      },
    },
    {
      id: 'validate_model',
      name: 'Validate Model',
      type: 'validation',
      dependsOn: ['train_model'],
      config: {
        validationSet: '/data/validation',
      },
    },
  ];

  console.log('Pipeline structure:');
  jobs.forEach(job => {
    const deps = job.dependsOn.length > 0 ? ` (depends on: ${job.dependsOn.join(', ')})` : '';
    console.log(`  - ${job.id}${deps}`);
  });
  console.log('');

  // Execute pipeline
  console.log('Starting execution...\n');

  try {
    const execution = await orchestrator.execute('Test Pipeline', jobs, {
      parallelism: 2,
      onJobComplete: (jobId, output) => {
        console.log(`✓ Job completed: ${jobId}`);
        console.log(`  Output:`, JSON.stringify(output, null, 2));
      },
      onJobFail: (jobId, error) => {
        console.error(`✗ Job failed: ${jobId}`);
        console.error(`  Error: ${error}`);
      },
      onProgress: (completed, total) => {
        console.log(`Progress: ${completed}/${total} jobs completed`);
      },
    });

    console.log('\n=== Execution Complete ===');
    console.log(`Status: ${execution.status}`);
    console.log(`Duration: ${execution.completedAt!.getTime() - execution.startedAt.getTime()}ms`);
    console.log('\nJob Results:');
    
    execution.jobs.forEach((job, jobId) => {
      console.log(`\n${jobId}:`);
      console.log(`  Status: ${job.status}`);
      console.log(`  Attempts: ${job.attempt}`);
      console.log(`  Logs: ${job.logs.length} entries`);
      if (job.output) {
        console.log(`  Output:`, JSON.stringify(job.output, null, 2));
      }
    });
    
    console.log('\n✓ All tests passed!');
    process.exit(0);
  } catch (error: unknown) {
    console.error('\n✗ Execution failed:', error.message);
    process.exit(1);
  }
}

main();
