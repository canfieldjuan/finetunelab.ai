import { DAGOrchestrator } from './lib/training/dag-orchestrator';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[ERROR] Missing Supabase credentials');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'set' : 'missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'set' : 'missing');
  process.exit(1);
}

async function testDAGOrchestrator() {
  console.log('[TEST] Starting DAG Orchestrator test...\n');

  const orchestrator = new DAGOrchestrator(supabaseUrl, supabaseServiceKey);

  console.log('[TEST] Step 1: Registering job handlers');
  
  orchestrator.registerHandler('training', async (job, context) => {
    context.log(`Starting training job: ${job.id}`);
    context.log(`Config: ${JSON.stringify(job.config)}`);
    
    await context.updateProgress(0);
    
    for (let i = 1; i <= 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const progress = (i / 5) * 100;
      await context.updateProgress(progress);
      context.log(`Training progress: ${progress}%`);
    }
    
    context.log('Training completed');
    return { status: 'success', metrics: { accuracy: 0.95, loss: 0.05 } };
  });

  orchestrator.registerHandler('preprocessing', async (job, context) => {
    context.log(`Starting preprocessing: ${job.id}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    context.log('Preprocessing completed');
    return { status: 'success', samples: 1000 };
  });

  orchestrator.registerHandler('validation', async (job, context) => {
    context.log(`Starting validation: ${job.id}`);
    const trainingOutput = context.getJobOutput('train-model');
    context.log(`Using training metrics: ${JSON.stringify(trainingOutput)}`);
    await new Promise(resolve => setTimeout(resolve, 800));
    context.log('Validation completed');
    return { status: 'success', validation_accuracy: 0.93 };
  });

  orchestrator.registerHandler('deployment', async (job, context) => {
    context.log(`Starting deployment: ${job.id}`);
    await new Promise(resolve => setTimeout(resolve, 600));
    context.log('Deployment completed');
    return { status: 'success', endpoint: 'https://api.example.com/model' };
  });

  console.log('[TEST] Handlers registered: training, preprocessing, validation, deployment\n');

  console.log('[TEST] Step 2: Creating DAG job configuration');
  const jobs = [
    {
      id: 'load-data',
      name: 'Load Dataset',
      type: 'preprocessing' as const,
      dependsOn: [],
      config: { source: 'test-dataset.csv', validation_split: 0.2 },
    },
    {
      id: 'preprocess',
      name: 'Preprocess Data',
      type: 'preprocessing' as const,
      dependsOn: ['load-data'],
      config: { normalize: true, augment: false },
    },
    {
      id: 'train-model',
      name: 'Train Model',
      type: 'training' as const,
      dependsOn: ['preprocess'],
      config: { model_type: 'transformer', epochs: 5, batch_size: 32 },
      retryConfig: { maxRetries: 2, retryDelayMs: 1000 },
    },
    {
      id: 'validate',
      name: 'Validate Model',
      type: 'validation' as const,
      dependsOn: ['train-model'],
      config: { metrics: ['accuracy', 'f1', 'loss'] },
    },
    {
      id: 'deploy',
      name: 'Deploy Model',
      type: 'deployment' as const,
      dependsOn: ['validate'],
      config: { environment: 'staging' },
    },
  ];

  console.log('[TEST] Jobs configured:');
  jobs.forEach(job => {
    const deps = job.dependsOn.length > 0 ? job.dependsOn.join(', ') : 'none';
    console.log(`  - ${job.id} (${job.type}) - depends on: ${deps}`);
  });
  console.log('');

  console.log('[TEST] Step 3: Executing DAG');
  let completedJobs = 0;
  const totalJobs = jobs.length;

  try {
    const execution = await orchestrator.execute('test-training-pipeline', jobs, {
      parallelism: 2,
      onJobComplete: (jobId, output) => {
        completedJobs++;
        console.log(`[PROGRESS] Job completed: ${jobId}`);
        console.log(`[PROGRESS] Output: ${JSON.stringify(output)}`);
        console.log(`[PROGRESS] Progress: ${completedJobs}/${totalJobs} (${Math.round((completedJobs/totalJobs)*100)}%)\n`);
      },
      onJobFail: (jobId, error) => {
        console.log(`[ERROR] Job failed: ${jobId}`);
        console.log(`[ERROR] Error: ${error}\n`);
      },
      onProgress: (completed, total) => {
        console.log(`[PROGRESS] Overall progress: ${completed}/${total} jobs completed\n`);
      }
    });

    console.log('[TEST] Step 4: DAG execution completed!');
    console.log(`[TEST] Execution ID: ${execution.id}`);
    console.log(`[TEST] Status: ${execution.status}`);
    console.log(`[TEST] Started: ${execution.startedAt}`);
    console.log(`[TEST] Completed: ${execution.completedAt}`);
    console.log(`[TEST] Duration: ${execution.completedAt ? Math.round((execution.completedAt.getTime() - execution.startedAt.getTime()) / 1000) : 0}s\n`);

    console.log('[TEST] Job Results:');
    execution.jobs.forEach((jobExec, jobId) => {
      console.log(`\n  ${jobId}:`);
      console.log(`    Status: ${jobExec.status}`);
      console.log(`    Attempt: ${jobExec.attempt}`);
      console.log(`    Output: ${JSON.stringify(jobExec.output)}`);
      if (jobExec.logs.length > 0) {
        console.log(`    Logs:`);
        jobExec.logs.forEach(log => console.log(`      ${log}`));
      }
    });

    console.log('\n[TEST] Test completed successfully!');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ERROR] DAG execution failed:', errorMessage);
    throw error;
  }
}

testDAGOrchestrator().catch(error => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('[ERROR] Test failed:', errorMessage);
  process.exit(1);
});
