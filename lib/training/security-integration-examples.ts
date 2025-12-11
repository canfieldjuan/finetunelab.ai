/**
 * Security Features Integration Example
 * 
 * Demonstrates Phase 1.4 security hardening features:
 * - Resource limits per job
 * - Audit logging
 * - Timeout enforcement
 * - Violation detection and handling
 */

import { DAGOrchestrator } from './dag-orchestrator';

// ============================================================================
// Helper to register job handlers
// ============================================================================

function registerJobHandlers(orchestrator: DAGOrchestrator) {
  // Echo handler for simple jobs
  orchestrator.registerHandler('echo', async (job, context) => {
    context.log(`Echo: ${job.config.message || 'Hello'}`);
    return { message: job.config.message || 'Hello' };
  });

  // Slow echo handler for timeout testing
  orchestrator.registerHandler('slow_echo', async (job, context) => {
    const delay = (job.config.delay as number) || 5000;
    context.log(`Slow echo starting, will wait ${delay}ms...`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    context.log(`Slow echo completed after ${delay}ms`);
    return { message: job.config.message || 'Slow operation complete', delay };
  });

  // Training handler
  orchestrator.registerHandler('training', async (job, context) => {
    context.log('Training job starting...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    context.log('Training complete');
    return { model: job.config.model || 'default', accuracy: 0.95 };
  });

  // Preprocessing handler
  orchestrator.registerHandler('preprocessing', async (job, context) => {
    context.log('Preprocessing job starting...');
    await new Promise(resolve => setTimeout(resolve, 500));
    context.log('Preprocessing complete');
    return { processed: true, records: 1000 };
  });

  // Validation handler
  orchestrator.registerHandler('validation', async (job, context) => {
    context.log('Validation job starting...');
    await new Promise(resolve => setTimeout(resolve, 300));
    context.log('Validation complete');
    return { validated: true, metrics: { accuracy: 0.92 } };
  });

  // Deployment handler
  orchestrator.registerHandler('deployment', async (job, context) => {
    context.log('Deployment job starting...');
    await new Promise(resolve => setTimeout(resolve, 400));
    context.log('Deployment complete');
    return { deployed: true, target: job.config.target || 'production' };
  });
}

// ============================================================================
// Example 1: Basic Resource Limits
// ============================================================================

export async function exampleBasicResourceLimits() {
  console.log('\n🔒 Example 1: Basic Resource Limits\n');
  console.log('='.repeat(60));

  const orchestrator = new DAGOrchestrator();
  registerJobHandlers(orchestrator);

  const execution = await orchestrator.execute(
    'Resource Limited Pipeline',
    [
      {
        id: 'preprocess',
        name: 'Data Preprocessing',
        type: 'preprocessing',
        dependsOn: [],
        config: { dataset: 'train.csv' },
        resourceLimits: {
          maxExecutionTimeMs: 30000, // 30 seconds max
          maxMemoryMB: 512, // 512MB max
          maxCpuPercent: 75, // 75% CPU max
        },
        timeoutMs: 30000,
      },
      {
        id: 'train',
        name: 'Model Training',
        type: 'training',
        dependsOn: ['preprocess'],
        config: { model: 'rf', epochs: 10 },
        resourceLimits: {
          maxExecutionTimeMs: 60000, // 1 minute max
          maxMemoryMB: 1024, // 1GB max
          maxCpuPercent: 80, // 80% CPU max
        },
        timeoutMs: 60000,
      },
      {
        id: 'validate',
        name: 'Model Validation',
        type: 'validation',
        dependsOn: ['train'],
        config: { testData: 'test.csv' },
        resourceLimits: {
          maxExecutionTimeMs: 20000, // 20 seconds max
          maxMemoryMB: 256, // 256MB max
        },
        timeoutMs: 20000,
      },
    ],
    {
      parallelism: 2,
      enableCache: false,
      onJobComplete: (jobId) => {
        console.log(`\n✅ Job ${jobId} completed successfully`);
      },
      onJobFail: (jobId, error) => {
        console.error(`\n❌ Job ${jobId} failed: ${error}`);
      },
    }
  );

  console.log('\n📊 Execution Summary:');
  console.log(`   Status: ${execution.status}`);
  console.log(`   Jobs: ${execution.jobs.size}`);
  console.log(`   Duration: ${execution.completedAt ? 
    (execution.completedAt.getTime() - execution.startedAt.getTime()) : 'N/A'}ms`);

  return execution;
}

// ============================================================================
// Example 2: Strict Resource Limits with Violation Handling
// ============================================================================

export async function exampleStrictResourceLimits() {
  console.log('\n🔒 Example 2: Strict Resource Limits with Violation Detection\n');
  console.log('='.repeat(60));

  const orchestrator = new DAGOrchestrator();
  registerJobHandlers(orchestrator);

  try {
    const execution = await orchestrator.execute(
      'Strict Resource Pipeline',
      [
        {
          id: 'heavy_job',
          name: 'Resource Intensive Job',
          type: 'training',
          dependsOn: [],
          config: { model: 'transformer', large: true },
          resourceLimits: {
            maxExecutionTimeMs: 5000, // Very short timeout
            maxMemoryMB: 100, // Very low memory limit
            maxCpuPercent: 50, // Low CPU limit
            enforceMemoryLimit: true,
            enforceCpuLimit: true,
            enforceTimeLimit: true,
          },
          timeoutMs: 5000,
        },
      ],
      {
        parallelism: 1,
        enableCache: false,
        onJobFail: (jobId, error) => {
          console.error(`\n❌ Job ${jobId} failed (expected due to strict limits): ${error}`);
        },
      }
    );

    console.log('\n📊 Execution Result:');
    console.log(`   Status: ${execution.status}`);
  } catch (error) {
    console.log('\n⚠️  Execution cancelled due to resource violations (expected behavior)');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// Example 3: Mixed Resource Limits Configuration
// ============================================================================

export async function exampleMixedResourceLimits() {
  console.log('\n🔒 Example 3: Mixed Resource Limits (Some Jobs Limited, Some Unlimited)\n');
  console.log('='.repeat(60));

  const orchestrator = new DAGOrchestrator();
  registerJobHandlers(orchestrator);

  const execution = await orchestrator.execute(
    'Mixed Resource Pipeline',
    [
      {
        id: 'quick_preprocess',
        name: 'Quick Preprocessing',
        type: 'echo',
        dependsOn: [],
        config: { message: 'Preprocessing complete' },
        // No resource limits - runs freely
      },
      {
        id: 'limited_train',
        name: 'Limited Training',
        type: 'training',
        dependsOn: ['quick_preprocess'],
        config: { model: 'lr' },
        resourceLimits: {
          maxExecutionTimeMs: 45000,
          maxMemoryMB: 768,
        },
        timeoutMs: 45000,
      },
      {
        id: 'quick_validate',
        name: 'Quick Validation',
        type: 'echo',
        dependsOn: ['limited_train'],
        config: { message: 'Validation complete' },
        // No resource limits
      },
      {
        id: 'limited_deploy',
        name: 'Limited Deployment',
        type: 'deployment',
        dependsOn: ['quick_validate'],
        config: { target: 'staging' },
        resourceLimits: {
          maxExecutionTimeMs: 30000,
          maxMemoryMB: 256,
          maxCpuPercent: 60,
        },
        timeoutMs: 30000,
      },
    ],
    {
      parallelism: 2,
      enableCache: false,
      onJobComplete: (jobId) => {
        console.log(`\n✅ Job ${jobId} completed`);
      },
    }
  );

  console.log('\n📊 Execution Summary:');
  console.log(`   Status: ${execution.status}`);
  console.log(`   Jobs with limits: 2/4`);
  console.log(`   Jobs without limits: 2/4`);

  return execution;
}

// ============================================================================
// Example 4: Timeout Enforcement
// ============================================================================

export async function exampleTimeoutEnforcement() {
  console.log('\n🔒 Example 4: Timeout Enforcement with Audit Logging\n');
  console.log('='.repeat(60));

  const orchestrator = new DAGOrchestrator();
  registerJobHandlers(orchestrator);

  try {
    const execution = await orchestrator.execute(
      'Timeout Enforcement Pipeline',
      [
        {
          id: 'slow_job',
          name: 'Intentionally Slow Job',
          type: 'slow_echo',
          dependsOn: [],
          config: { message: 'Slow operation', delay: 10000 }, // 10 second delay
          resourceLimits: {
            maxExecutionTimeMs: 5000, // 5 second limit
            enforceTimeLimit: true,
          },
          timeoutMs: 5000, // Will timeout before completion
        },
      ],
      {
        parallelism: 1,
        enableCache: false,
        onJobFail: (jobId, error) => {
          console.error(`\n❌ Job ${jobId} failed due to timeout (expected): ${error}`);
        },
      }
    );

    console.log('\n📊 Execution Result:');
    console.log(`   Status: ${execution.status}`);
  } catch (error) {
    console.log('\n⚠️  Execution failed due to timeout (expected behavior)');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// Example 5: Progressive Resource Limits
// ============================================================================

export async function exampleProgressiveResourceLimits() {
  console.log('\n🔒 Example 5: Progressive Resource Limits (Increasing with Pipeline Stage)\n');
  console.log('='.repeat(60));

  const orchestrator = new DAGOrchestrator();
  registerJobHandlers(orchestrator);

  const execution = await orchestrator.execute(
    'Progressive Resource Pipeline',
    [
      {
        id: 'stage1_explore',
        name: 'Stage 1: Data Exploration',
        type: 'preprocessing',
        dependsOn: [],
        config: { operation: 'explore' },
        resourceLimits: {
          maxExecutionTimeMs: 20000, // 20s
          maxMemoryMB: 256, // 256MB - small
        },
        timeoutMs: 20000,
      },
      {
        id: 'stage2_feature_eng',
        name: 'Stage 2: Feature Engineering',
        type: 'preprocessing',
        dependsOn: ['stage1_explore'],
        config: { operation: 'features' },
        resourceLimits: {
          maxExecutionTimeMs: 40000, // 40s
          maxMemoryMB: 512, // 512MB - medium
        },
        timeoutMs: 40000,
      },
      {
        id: 'stage3_train',
        name: 'Stage 3: Model Training',
        type: 'training',
        dependsOn: ['stage2_feature_eng'],
        config: { model: 'ensemble' },
        resourceLimits: {
          maxExecutionTimeMs: 60000, // 60s
          maxMemoryMB: 1024, // 1GB - large
        },
        timeoutMs: 60000,
      },
      {
        id: 'stage4_optimize',
        name: 'Stage 4: Hyperparameter Optimization',
        type: 'training',
        dependsOn: ['stage3_train'],
        config: { operation: 'tuning' },
        resourceLimits: {
          maxExecutionTimeMs: 120000, // 2 minutes
          maxMemoryMB: 2048, // 2GB - extra large
          maxCpuPercent: 90, // Allow high CPU
        },
        timeoutMs: 120000,
      },
    ],
    {
      parallelism: 1, // Sequential execution
      enableCache: false,
      onJobComplete: (jobId) => {
        console.log(`\n✅ ${jobId} completed with allocated resources`);
      },
    }
  );

  console.log('\n📊 Execution Summary:');
  console.log(`   Status: ${execution.status}`);
  console.log(`   Resource progression: 256MB → 512MB → 1GB → 2GB`);
  console.log(`   Time progression: 20s → 40s → 60s → 120s`);

  return execution;
}

// ============================================================================
// Run All Examples
// ============================================================================

async function runAllExamples() {
  console.log('\n' + '='.repeat(80));
  console.log('🔒 Phase 1.4 Security Features Integration Examples');
  console.log('='.repeat(80));

  try {
    // Example 1: Basic resource limits
    await exampleBasicResourceLimits();
    console.log('\n' + '-'.repeat(80));

    // Example 2: Strict limits with violation handling
    await exampleStrictResourceLimits();
    console.log('\n' + '-'.repeat(80));

    // Example 3: Mixed configuration
    await exampleMixedResourceLimits();
    console.log('\n' + '-'.repeat(80));

    // Example 4: Timeout enforcement
    await exampleTimeoutEnforcement();
    console.log('\n' + '-'.repeat(80));

    // Example 5: Progressive limits
    await exampleProgressiveResourceLimits();

    console.log('\n' + '='.repeat(80));
    console.log('✨ All security integration examples completed!');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('\n💥 Example suite failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}
