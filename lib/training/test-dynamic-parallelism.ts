/**
 * Dynamic Parallelism Validation Tests
 * 
 * Tests for Phase 2.1: Fan-Out/Fan-In implementation
 * - Parameter combination generation
 * - Template placeholder replacement
 * - Dynamic job generation
 * - Result aggregation strategies
 */

import {
  generateParameterCombinations,
  generateDynamicJobs,
  aggregateResults,
  replacePlaceholders,
  replacePlaceholdersInObject,
  isFanOutJob,
  getGeneratedJobIds,
  ParameterSpec,
  FanOutJobConfig,
  AggregationConfig,
} from './dynamic-parallelism';

// ============================================================================
// Test Helpers
// ============================================================================

function logTestResult(testName: string, passed: boolean, details?: string): void {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`\n${status}: ${testName}`);
  if (details) {
    console.log(`   Details: ${details}`);
  }
}

// ============================================================================
// Test Suite
// ============================================================================

async function runDynamicParallelismTests() {
  console.log('\n🔄 Dynamic Parallelism Test Suite\n');
  console.log('='.repeat(60));

  let testsPassed = 0;
  let testsFailed = 0;

  // ==========================================================================
  // Test 1: Parameter Combination Generation
  // ==========================================================================
  {
    const testName = 'Parameter Combination Generation';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const parameters: ParameterSpec[] = [
        { name: 'lr', values: [0.001, 0.01], type: 'number' },
        { name: 'bs', values: [16, 32], type: 'number' },
      ];

      const combinations = generateParameterCombinations(parameters);

      // Should generate 2 * 2 = 4 combinations
      if (combinations.length !== 4) {
        throw new Error(`Expected 4 combinations, got ${combinations.length}`);
      }

      // Verify all combinations are unique
      const uniqueKeys = new Set(combinations.map(c => JSON.stringify(c)));
      if (uniqueKeys.size !== 4) {
        throw new Error(`Expected 4 unique combinations, got ${uniqueKeys.size}`);
      }

      // Verify structure
      const firstCombo = combinations[0];
      if (!('lr' in firstCombo && 'bs' in firstCombo)) {
        throw new Error('Combination missing expected parameters');
      }

      logTestResult(testName, true, `Generated ${combinations.length} valid combinations`);
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Test 2: Placeholder Replacement - String
  // ==========================================================================
  {
    const testName = 'Placeholder Replacement - String';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const template = 'Train ${model} with lr=${lr}';
      const params = { model: 'gpt2', lr: 0.001 };

      const result = replacePlaceholders(template, params);

      const expected = 'Train gpt2 with lr=0.001';
      if (result !== expected) {
        throw new Error(`Expected "${expected}", got "${result}"`);
      }

      logTestResult(testName, true, `Replaced placeholders correctly`);
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Test 3: Placeholder Replacement - Object
  // ==========================================================================
  {
    const testName = 'Placeholder Replacement - Object';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const template = {
        model: '${model_name}',
        config: {
          lr: '${learning_rate}',
        },
        paths: ['data/${model_name}'],
      };

      const params = {
        model_name: 'bert',
        learning_rate: 0.001,
      };

      const result = replacePlaceholdersInObject(template, params);

      if (result.model !== 'bert') {
        throw new Error(`Expected model='bert', got '${result.model}'`);
      }

      const config = result.config as Record<string, unknown>;
      if (config.lr !== '0.001') {
        throw new Error(`Expected lr='0.001', got '${config.lr}'`);
      }

      const paths = result.paths as string[];
      if (paths[0] !== 'data/bert') {
        throw new Error(`Expected path='data/bert', got '${paths[0]}'`);
      }

      logTestResult(testName, true, 'Deep object replacement works');
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Test 4: Dynamic Job Generation
  // ==========================================================================
  {
    const testName = 'Dynamic Job Generation';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const fanOutConfig: FanOutJobConfig = {
        id: 'test_fanout',
        name: 'Test Fan-Out',
        type: 'fan-out',
        dependsOn: ['prep'],
        template: {
          namePattern: 'Job ${param}',
          type: 'training',
          config: {
            value: '${param}',
          },
        },
        parameters: [
          { name: 'param', values: ['A', 'B', 'C'], type: 'string' },
        ],
        config: {},
      };

      const { jobs, metadata } = generateDynamicJobs(fanOutConfig, ['prep']);

      // Should generate 3 jobs
      if (jobs.length !== 3) {
        throw new Error(`Expected 3 jobs, got ${jobs.length}`);
      }

      // Verify IDs start with source job ID
      for (const job of jobs) {
        if (!job.id.startsWith('test_fanout_')) {
          throw new Error(`Job ID ${job.id} doesn't start with 'test_fanout_'`);
        }
      }

      // Verify dependencies
      for (const job of jobs) {
        if (job.dependsOn.length !== 1 || job.dependsOn[0] !== 'prep') {
          throw new Error(`Job ${job.id} has incorrect dependencies`);
        }
      }

      // Verify metadata
      if (metadata.size !== 3) {
        throw new Error(`Expected 3 metadata entries, got ${metadata.size}`);
      }

      logTestResult(testName, true, `Generated ${jobs.length} jobs with metadata`);
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Test 5: Aggregation - Collect All
  // ==========================================================================
  {
    const testName = 'Aggregation Strategy - Collect All';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const outputs = [
        { value: 1 },
        { value: 2 },
        { value: 3 },
      ];

      const config: AggregationConfig = {
        strategy: 'collect-all',
      };

      const result = aggregateResults(outputs, config);

      if (!Array.isArray(result)) {
        throw new Error('Result should be an array');
      }

      if (result.length !== 3) {
        throw new Error(`Expected 3 items, got ${result.length}`);
      }

      logTestResult(testName, true, 'Collected all outputs');
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Test 6: Aggregation - Best Metric
  // ==========================================================================
  {
    const testName = 'Aggregation Strategy - Best Metric';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const outputs = [
        { metrics: { accuracy: 0.85 }, model: 'A' },
        { metrics: { accuracy: 0.92 }, model: 'B' },
        { metrics: { accuracy: 0.88 }, model: 'C' },
      ];

      const config: AggregationConfig = {
        strategy: 'best-metric',
        metricName: 'accuracy',
        ascending: false, // Higher is better
      };

      const result = aggregateResults(outputs, config) as { model: string };

      if (result.model !== 'B') {
        throw new Error(`Expected model B (highest accuracy), got ${result.model}`);
      }

      logTestResult(testName, true, 'Selected best model by accuracy');
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Test 7: Aggregation - Average Metrics
  // ==========================================================================
  {
    const testName = 'Aggregation Strategy - Average Metrics';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const outputs = [
        { metrics: { accuracy: 0.80, loss: 0.2 } },
        { metrics: { accuracy: 0.90, loss: 0.1 } },
        { metrics: { accuracy: 0.85, loss: 0.15 } },
      ];

      const config: AggregationConfig = {
        strategy: 'average-metrics',
      };

      const result = aggregateResults(outputs, config) as { metrics: { accuracy: number; loss: number } };

      const expectedAccuracy = (0.80 + 0.90 + 0.85) / 3;
      const expectedLoss = (0.2 + 0.1 + 0.15) / 3;

      if (Math.abs(result.metrics.accuracy - expectedAccuracy) > 0.001) {
        throw new Error(`Expected accuracy ${expectedAccuracy}, got ${result.metrics.accuracy}`);
      }

      if (Math.abs(result.metrics.loss - expectedLoss) > 0.001) {
        throw new Error(`Expected loss ${expectedLoss}, got ${result.metrics.loss}`);
      }

      logTestResult(testName, true, `Averaged metrics: accuracy=${result.metrics.accuracy.toFixed(3)}, loss=${result.metrics.loss.toFixed(3)}`);
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Test 8: Aggregation - Custom Function
  // ==========================================================================
  {
    const testName = 'Aggregation Strategy - Custom Function';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const outputs = [1, 2, 3, 4, 5];

      const config: AggregationConfig = {
        strategy: 'custom',
        customAggregator: (items: unknown[]) => {
          // Sum all numbers
          return items.reduce((sum: number, val) => sum + (val as number), 0);
        },
      };

      const result = aggregateResults(outputs, config);

      if (result !== 15) {
        throw new Error(`Expected sum=15, got ${result}`);
      }

      logTestResult(testName, true, 'Custom aggregation function works');
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Test 9: Type Guards
  // ==========================================================================
  {
    const testName = 'Type Guards (isFanOutJob, isFanInJob)';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const fanOutConfig: FanOutJobConfig = {
        id: 'test_fanout',
        name: 'Test',
        type: 'fan-out',
        dependsOn: [],
        template: {
          namePattern: 'Test',
          type: 'training',
          config: {},
        },
        parameters: [],
        config: {},
      };

      const regularJob = {
        id: 'regular',
        name: 'Regular Job',
        type: 'training' as const,
        dependsOn: [],
        config: {},
      };

      if (!isFanOutJob(fanOutConfig)) {
        throw new Error('Fan-out job not detected');
      }

      if (isFanOutJob(regularJob)) {
        throw new Error('Regular job incorrectly detected as fan-out');
      }

      logTestResult(testName, true, 'Type guards work correctly');
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Test 10: Get Generated Job IDs
  // ==========================================================================
  {
    const testName = 'Get Generated Job IDs';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const allJobIds = [
        'prep',
        'search_0_lr_0.001',
        'search_1_lr_0.01',
        'search_2_lr_0.1',
        'other_job',
      ];

      const generatedIds = getGeneratedJobIds('search', allJobIds);

      if (generatedIds.length !== 3) {
        throw new Error(`Expected 3 generated IDs, got ${generatedIds.length}`);
      }

      for (const id of generatedIds) {
        if (!id.startsWith('search_')) {
          throw new Error(`ID ${id} doesn't start with 'search_'`);
        }
      }

      logTestResult(testName, true, `Found ${generatedIds.length} generated job IDs`);
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Results Summary:\n');
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`   📈 Total:  ${testsPassed + testsFailed}`);
  console.log(`   🎯 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('\n' + '='.repeat(60));

  if (testsFailed > 0) {
    console.log('\n⚠️  Some tests failed. Review the output above for details.');
    process.exit(1);
  } else {
    console.log('\n✨ All dynamic parallelism tests passed!');
    process.exit(0);
  }
}

// ============================================================================
// Run Tests
// ============================================================================

runDynamicParallelismTests().catch(error => {
  console.error('\n💥 Test suite crashed:', error);
  process.exit(1);
});
