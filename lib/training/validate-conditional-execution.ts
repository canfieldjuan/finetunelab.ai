#!/usr/bin/env tsx
/**
 * Validation Script for Conditional Execution Feature
 * 
 * Tests the conditional execution implementation with a simple mock workflow
 */

import DAGOrchestrator, { JobConfig, JobHandler } from './dag-orchestrator';

// Mock handlers that return predictable results
const mockHandlers: Partial<Record<string, JobHandler>> = {
  training: async () => {
    console.log('  [TRAIN] Training model...');
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      modelId: 'model_123',
      trainingLoss: 0.45,
      trainingTime: 100,
    };
  },
  
  validation: async () => {
    console.log('  [VALIDATE] Validating model...');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Randomly return high or low accuracy to test conditional logic
    const accuracy = Math.random() > 0.5 ? 0.92 : 0.78;
    console.log(`  [VALIDATE] Accuracy: ${accuracy}`);
    
    return {
      metrics: {
        accuracy,
        f1: accuracy - 0.05,
        precision: accuracy + 0.02,
      },
    };
  },
  
  deployment: async () => {
    console.log('  [DEPLOY] Deploying model...');
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      endpointUrl: 'https://api.example.com/model',
      deployedAt: new Date().toISOString(),
    };
  },
};

async function testConditionalExecution() {
  console.log('\n=== Conditional Execution Validation Test ===\n');
  
  const orchestrator = new DAGOrchestrator();
  
  // Register mock handlers
  Object.entries(mockHandlers).forEach(([type, handler]) => {
    if (handler) {
      orchestrator.registerHandler(type as 'training' | 'validation' | 'deployment', handler);
    }
  });
  
  const jobs: JobConfig[] = [
    {
      id: 'train_model',
      name: 'Train Model',
      type: 'training',
      dependsOn: [],
      config: {
        modelType: 'test-model',
      },
    },
    {
      id: 'validate_model',
      name: 'Validate Model',
      type: 'validation',
      dependsOn: ['train_model'],
      config: {
        dataset: 'test-dataset',
      },
    },
    {
      id: 'deploy_if_good',
      name: 'Deploy to Production (if accuracy > 90%)',
      type: 'deployment',
      dependsOn: ['validate_model'],
      config: {
        target: 'production',
      },
      // 🎯 CONDITIONAL EXECUTION TEST
      condition: ({ getJobOutput }) => {
        const validationResult = getJobOutput('validate_model') as {
          metrics?: { accuracy?: number };
        } | null;
        
        const accuracy = validationResult?.metrics?.accuracy ?? 0;
        const threshold = 0.90;
        const shouldDeploy = accuracy > threshold;
        
        console.log(`  [CONDITION] Accuracy: ${accuracy}, Threshold: ${threshold}`);
        console.log(`  [CONDITION] Decision: ${shouldDeploy ? 'DEPLOY' : 'SKIP'}`);
        
        return shouldDeploy;
      },
    },
  ];
  
  const execution = await orchestrator.execute('Conditional Test', jobs);
  
  // Validate results
  console.log('\n=== Execution Results ===');
  execution.jobs.forEach((job, id) => {
    const statusIcon = job.status === 'completed' ? '✅' : 
                      job.status === 'skipped' ? '⏭️' : 
                      job.status === 'failed' ? '❌' : '⏳';
    console.log(`${statusIcon} ${id}: ${job.status}`);
    
    if (job.output) {
      console.log(`   Output: ${JSON.stringify(job.output, null, 2).split('\n').join('\n   ')}`);
    }
  });
  
  // Verify conditional logic worked
  const trainJob = execution.jobs.get('train_model');
  const validateJob = execution.jobs.get('validate_model');
  const deployJob = execution.jobs.get('deploy_if_good');
  
  console.log('\n=== Validation Checks ===');
  
  // Check 1: Train should always complete
  if (trainJob?.status === 'completed') {
    console.log('✅ Train job completed as expected');
  } else {
    console.log(`❌ Train job status unexpected: ${trainJob?.status}`);
  }
  
  // Check 2: Validate should always complete
  if (validateJob?.status === 'completed') {
    console.log('✅ Validate job completed as expected');
  } else {
    console.log(`❌ Validate job status unexpected: ${validateJob?.status}`);
  }
  
  // Check 3: Deploy should be either completed or skipped based on accuracy
  const validateOutput = validateJob?.output as { metrics?: { accuracy?: number } } | undefined;
  const accuracy = validateOutput?.metrics?.accuracy ?? 0;
  
  if (accuracy > 0.90) {
    if (deployJob?.status === 'completed') {
      console.log(`✅ Deploy job completed (accuracy ${accuracy} > 0.90)`);
    } else {
      console.log(`❌ Deploy should have completed but was ${deployJob?.status}`);
    }
  } else {
    if (deployJob?.status === 'skipped') {
      console.log(`✅ Deploy job skipped (accuracy ${accuracy} ≤ 0.90)`);
      
      // Check skipped output format
      const deployOutput = deployJob.output as { skipped?: boolean; reason?: string } | undefined;
      if (deployOutput?.skipped === true && deployOutput?.reason === 'Condition not met') {
        console.log('✅ Skipped output format correct');
      } else {
        console.log(`❌ Skipped output format incorrect: ${JSON.stringify(deployOutput)}`);
      }
    } else {
      console.log(`❌ Deploy should have been skipped but was ${deployJob?.status}`);
    }
  }
  
  // Check 4: Verify execution completed
  if (execution.status === 'completed') {
    console.log('✅ Overall execution completed successfully');
  } else {
    console.log(`❌ Overall execution status: ${execution.status}`);
  }
  
  console.log('\n=== Test Complete ===\n');
  
  return execution;
}

// Run the test multiple times to ensure both code paths (deploy/skip) work
async function runMultipleTests() {
  console.log('Running 3 test iterations to exercise both conditions...\n');
  
  for (let i = 1; i <= 3; i++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test Iteration ${i}/3`);
    console.log('='.repeat(60));
    await testConditionalExecution();
  }
}

// Run if executed directly
if (require.main === module) {
  runMultipleTests().catch(console.error);
}

export { testConditionalExecution };
