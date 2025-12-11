// ============================================================================
// Dynamic Handlers Test Suite
// ============================================================================
// Validation tests for fan-out and fan-in job handlers
//
// Author: System
// Last Modified: 2024
// ============================================================================

import { fanOutHandler, fanInHandler } from './dynamic-handlers';
import { JobConfig, JobContext } from './dag-orchestrator';

// ============================================================================
// Test Utilities
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  error?: string;
}

const results: TestResult[] = [];

function createMockContext(outputs: Map<string, unknown> = new Map()): JobContext {
  const logs: string[] = [];
  
  return {
    executionId: 'test_execution',
    log: (message: string) => {
      logs.push(message);
    },
    getJobOutput: (jobId: string) => {
      return outputs.get(jobId);
    },
    updateProgress: async () => {},
  };
}

function test(name: string, fn: () => void | Promise<void>) {
  return async () => {
    console.log(`\n📋 Running: ${name}\n`);
    try {
      await fn();
      results.push({
        name,
        passed: true,
        details: 'Test completed successfully',
      });
      console.log(`✅ PASS: ${name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        name,
        passed: false,
        details: 'Test failed',
        error: errorMessage,
      });
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${errorMessage}`);
    }
  };
}

function assertEquals(actual: unknown, expected: unknown, message: string) {
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);
  
  if (actualStr !== expectedStr) {
    throw new Error(`${message}\n  Expected: ${expectedStr}\n  Actual: ${actualStr}`);
  }
}

function assertApproxEquals(actual: number, expected: number, tolerance: number, message: string) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}\n  Expected: ${expected} (±${tolerance})\n  Actual: ${actual}`);
  }
}

// ============================================================================
// Tests
// ============================================================================

const test1 = test('Fan-Out Handler - Basic Generation', async () => {
  const fanOutJob: JobConfig = {
    id: 'test_fanout',
    name: 'Test Fan-Out',
    type: 'fan-out',
    dependsOn: [],
    config: {},
    template: {
      type: 'train',
      namePattern: 'Train with lr=${lr}',
      config: {
        learningRate: '${lr}',
        batchSize: 32,
      },
    },
    parameters: [
      { name: 'lr', values: [0.001, 0.01] },
    ],
  } as unknown as JobConfig;

  const context = createMockContext();
  const result = await fanOutHandler(fanOutJob, context);

  assertEquals(result.generatedJobIds.length, 2, 'Should generate 2 jobs');
  assertEquals(result.parameterCount, 1, 'Should have 1 parameter');
  assertEquals(result.sourceJobId, 'test_fanout', 'Should track source job ID');
  
  console.log(`   Details: Generated ${result.generatedJobIds.length} jobs`);
});

const test2 = test('Fan-Out Handler - Multiple Parameters', async () => {
  const fanOutJob: JobConfig = {
    id: 'multi_param_fanout',
    name: 'Multi-Parameter Fan-Out',
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
  } as unknown as JobConfig;

  const context = createMockContext();
  const result = await fanOutHandler(fanOutJob, context);

  // 3 learning rates × 2 batch sizes = 6 combinations
  assertEquals(result.generatedJobIds.length, 6, 'Should generate 6 jobs (3×2)');
  assertEquals(result.parameterCount, 2, 'Should have 2 parameters');
  
  console.log(`   Details: Generated ${result.generatedJobIds.length} jobs from ${result.parameterCount} parameters`);
});

const test3 = test('Fan-In Handler - Collect All Strategy', async () => {
  const outputs = new Map<string, unknown>();
  
  // Mock fan-out output
  outputs.set('test_fanout', {
    generatedJobIds: ['job_1', 'job_2', 'job_3'],
  });
  
  // Mock generated job outputs
  outputs.set('job_1', { accuracy: 0.85, loss: 0.15 });
  outputs.set('job_2', { accuracy: 0.90, loss: 0.10 });
  outputs.set('job_3', { accuracy: 0.88, loss: 0.12 });

  const fanInJob: JobConfig = {
    id: 'test_fanin',
    name: 'Test Fan-In',
    type: 'fan-in',
    dependsOn: ['test_fanout'],
    config: {},
    fanOutJobId: 'test_fanout',
    aggregation: {
      strategy: 'collect-all',
    },
  } as unknown as JobConfig;

  const context = createMockContext(outputs);
  const result = await fanInHandler(fanInJob, context);

  assertEquals(result.strategy, 'collect-all', 'Should use collect-all strategy');
  assertEquals(result.inputCount, 3, 'Should aggregate 3 outputs');
  assertEquals(result.sourceJobId, 'test_fanout', 'Should track source fan-out job');
  
  const aggregated = result.aggregatedResult as unknown[];
  assertEquals(aggregated.length, 3, 'Should collect all 3 results');
  
  console.log(`   Details: Aggregated ${result.inputCount} results using ${result.strategy}`);
});

const test4 = test('Fan-In Handler - Best Metric Strategy', async () => {
  const outputs = new Map<string, unknown>();
  
  outputs.set('test_fanout', {
    generatedJobIds: ['job_1', 'job_2', 'job_3'],
  });
  
  outputs.set('job_1', { accuracy: 0.85, loss: 0.15 });
  outputs.set('job_2', { accuracy: 0.90, loss: 0.10 }); // Best
  outputs.set('job_3', { accuracy: 0.88, loss: 0.12 });

  const fanInJob: JobConfig = {
    id: 'test_fanin',
    name: 'Test Fan-In',
    type: 'fan-in',
    dependsOn: ['test_fanout'],
    config: {},
    fanOutJobId: 'test_fanout',
    aggregation: {
      strategy: 'best-metric',
      metricName: 'accuracy',
      ascending: false, // Higher is better
    },
  } as unknown as JobConfig;

  const context = createMockContext(outputs);
  const result = await fanInHandler(fanInJob, context);

  const best = result.aggregatedResult as { accuracy: number; loss: number };
  assertEquals(best.accuracy, 0.90, 'Should select best accuracy (0.90)');
  assertEquals(best.loss, 0.10, 'Should include loss from best model');
  
  console.log(`   Details: Selected best model with accuracy=${best.accuracy}`);
});

const test5 = test('Fan-In Handler - Average Metrics Strategy', async () => {
  const outputs = new Map<string, unknown>();
  
  outputs.set('test_fanout', {
    generatedJobIds: ['job_1', 'job_2'],
  });
  
  outputs.set('job_1', { accuracy: 0.80, loss: 0.20 });
  outputs.set('job_2', { accuracy: 0.90, loss: 0.10 });

  const fanInJob: JobConfig = {
    id: 'test_fanin',
    name: 'Test Fan-In',
    type: 'fan-in',
    dependsOn: ['test_fanout'],
    config: {},
    fanOutJobId: 'test_fanout',
    aggregation: {
      strategy: 'average-metrics',
    },
  } as unknown as JobConfig;

  const context = createMockContext(outputs);
  const result = await fanInHandler(fanInJob, context);

  const averaged = result.aggregatedResult as { metrics: Record<string, number> };
  
  // Average accuracy: (0.80 + 0.90) / 2 = 0.85
  // Average loss: (0.20 + 0.10) / 2 = 0.15
  assertApproxEquals(averaged.metrics.accuracy, 0.85, 0.0001, 'Should average accuracy to 0.85');
  assertApproxEquals(averaged.metrics.loss, 0.15, 0.0001, 'Should average loss to 0.15');
  
  console.log(`   Details: Averaged metrics - accuracy=${averaged.metrics.accuracy}, loss=${averaged.metrics.loss}`);
});

// ============================================================================
// Main Test Runner
// ============================================================================

async function runTests() {
  console.log('🔄 Dynamic Handlers Test Suite\n');
  console.log('='.repeat(60));

  await test1();
  await test2();
  await test3();
  await test4();
  await test5();

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Results Summary:\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const successRate = ((passed / total) * 100).toFixed(1);

  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Total:  ${total}`);
  console.log(`   🎯 Success Rate: ${successRate}%`);

  console.log('\n' + '='.repeat(60) + '\n');

  if (failed === 0) {
    console.log('✨ All dynamic handler tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Review errors above.');
    process.exit(1);
  }
}

runTests().catch(console.error);

