// ============================================================================
// Dynamic Parallelism Integration Example
// ============================================================================
// End-to-end example demonstrating fan-out/fan-in with DAG orchestrator
// Use case: Hyperparameter search for model training
//
// Author: System
// Last Modified: 2024
// ============================================================================

import DAGOrchestrator, { JobConfig, JobContext } from './dag-orchestrator';
import registerDynamicHandlers from './register-dynamic-handlers';

// ============================================================================
// Mock Training Handler
// ============================================================================

/**
 * Mock training handler for demonstration
 * Simulates model training with different hyperparameters
 */
async function mockTrainingHandler(
  job: JobConfig,
  context: JobContext
): Promise<{ accuracy: number; loss: number; config: Record<string, unknown> }> {
  const config = job.config;
  const lr = config.learningRate as number;
  const bs = config.batchSize as number;
  
  context.log(`Training with lr=${lr}, bs=${bs}`);
  
  // Simulate training with random results
  // (In reality, accuracy would depend on actual training)
  const accuracy = 0.75 + Math.random() * 0.2; // 0.75-0.95
  const loss = 0.05 + Math.random() * 0.15;    // 0.05-0.20
  
  context.log(`Training complete: accuracy=${accuracy.toFixed(3)}, loss=${loss.toFixed(3)}`);
  
  return {
    accuracy: Number(accuracy.toFixed(3)),
    loss: Number(loss.toFixed(3)),
    config: { learningRate: lr, batchSize: bs },
  };
}

// ============================================================================
// Integration Example: Hyperparameter Search
// ============================================================================

async function runHyperparameterSearchExample() {
  console.log('🔄 Dynamic Parallelism Integration Example\n');
  console.log('='.repeat(60));
  console.log('\n📋 Use Case: Hyperparameter Search for Model Training\n');

  // Create orchestrator
  const orchestrator = new DAGOrchestrator();
  
  // Register dynamic handlers
  registerDynamicHandlers(orchestrator);
  
  // Register mock training handler
  orchestrator.registerHandler('train', mockTrainingHandler);

  console.log('✅ Handlers registered\n');

  // Define workflow with fan-out and fan-in
  const jobs: JobConfig[] = [
    // Fan-out: Generate training jobs for different hyperparameters
    {
      id: 'hyperparam_search',
      name: 'Hyperparameter Search',
      type: 'fan-out',
      dependsOn: [],
      config: {},
      template: {
        type: 'train',
        namePattern: 'Train lr=${lr} bs=${bs}',
        config: {
          learningRate: '${lr}',
          batchSize: '${bs}',
        },
      },
      parameters: [
        { name: 'lr', values: [0.001, 0.01, 0.1] },
        { name: 'bs', values: [16, 32] },
      ],
    } as unknown as JobConfig,

    // Fan-in: Select best model based on accuracy
    {
      id: 'select_best_model',
      name: 'Select Best Model',
      type: 'fan-in',
      dependsOn: ['hyperparam_search'],
      config: {},
      fanOutJobId: 'hyperparam_search',
      aggregation: {
        strategy: 'best-metric',
        metricName: 'accuracy',
        ascending: false, // Higher accuracy is better
      },
    } as unknown as JobConfig,
  ];

  console.log('📦 Workflow defined:');
  console.log('  1. Fan-out: 3 learning rates × 2 batch sizes = 6 training jobs');
  console.log('  2. Fan-in: Select best model by accuracy\n');

  console.log('='.repeat(60));
  console.log('\n🚀 Starting execution...\n');

  try {
    const execution = await orchestrator.execute(
      'Hyperparameter Search Pipeline',
      jobs,
      {
        parallelism: 3,
        enableCache: false,
        onJobComplete: (jobId) => {
          console.log(`✅ Job completed: ${jobId}`);
        },
        onJobFail: (jobId, error) => {
          console.error(`❌ Job failed: ${jobId} - ${error}`);
        },
      }
    );

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Execution Results:\n');
    console.log(`Execution ID: ${execution.id}`);
    console.log(`Status: ${execution.status}`);
    console.log(`Duration: ${execution.completedAt!.getTime() - execution.startedAt.getTime()}ms\n`);

    // Display fan-out results
    console.log('🔀 Fan-Out Results (Generated Jobs):');
    const fanOutOutput = execution.jobs.get('hyperparam_search')?.output as {
      generatedJobIds: string[];
      parameterCount: number;
    };
    
    if (fanOutOutput) {
      console.log(`  Generated ${fanOutOutput.generatedJobIds.length} training jobs`);
      console.log(`  Parameter dimensions: ${fanOutOutput.parameterCount}\n`);
      
      console.log('  Individual Training Results:');
      fanOutOutput.generatedJobIds.forEach((jobId) => {
        const jobOutput = execution.jobs.get(jobId)?.output as {
          accuracy: number;
          loss: number;
          config: Record<string, unknown>;
        };
        
        if (jobOutput) {
          console.log(`    - ${jobId}:`);
          console.log(`        accuracy: ${jobOutput.accuracy}`);
          console.log(`        loss: ${jobOutput.loss}`);
          console.log(`        config: lr=${jobOutput.config.learningRate}, bs=${jobOutput.config.batchSize}`);
        }
      });
    }

    // Display fan-in results
    console.log('\n🔄 Fan-In Results (Best Model):');
    const fanInOutput = execution.jobs.get('select_best_model')?.output as {
      aggregatedResult: {
        accuracy: number;
        loss: number;
        config: Record<string, unknown>;
      };
      strategy: string;
      inputCount: number;
    };
    
    if (fanInOutput) {
      console.log(`  Strategy: ${fanInOutput.strategy}`);
      console.log(`  Models evaluated: ${fanInOutput.inputCount}`);
      console.log(`  Best model:`);
      console.log(`    - accuracy: ${fanInOutput.aggregatedResult.accuracy}`);
      console.log(`    - loss: ${fanInOutput.aggregatedResult.loss}`);
      console.log(`    - config: lr=${fanInOutput.aggregatedResult.config.learningRate}, bs=${fanInOutput.aggregatedResult.config.batchSize}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✨ Hyperparameter search complete!\n');
    console.log('🎯 Key Takeaways:');
    console.log('  - Fan-out generated 6 parallel training jobs automatically');
    console.log('  - Each job trained with different hyperparameters');
    console.log('  - Fan-in aggregated results and selected best model');
    console.log('  - No manual job creation required!\n');

    return execution;
  } catch (error) {
    console.error('\n❌ Execution failed:', error);
    throw error;
  }
}

// ============================================================================
// Main
// ============================================================================

if (require.main === module) {
  runHyperparameterSearchExample().catch(console.error);
}

export default runHyperparameterSearchExample;
