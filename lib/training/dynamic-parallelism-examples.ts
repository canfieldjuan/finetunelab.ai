/**
 * Dynamic Parallelism Examples
 * 
 * Demonstrates fan-out/fan-in patterns for:
 * - Hyperparameter search
 * - A/B testing
 * - Data sharding
 * - Multi-model ensemble
 * 
 * Phase 2.1 Implementation Examples
 */

import {
  generateParameterCombinations,
  generateDynamicJobs,
  aggregateResults,
  replacePlaceholders,
  replacePlaceholdersInObject,
  FanOutJobConfig,
  FanInJobConfig,
  ParameterSpec,
  JobTemplate,
  AggregationConfig,
} from './dynamic-parallelism';

// ============================================================================
// Example 1: Hyperparameter Search
// ============================================================================

export function exampleHyperparameterSearch(): {
  fanOut: FanOutJobConfig;
  fanIn: FanInJobConfig;
} {
  console.log('\n🔄 Example 1: Hyperparameter Search\n');
  console.log('='.repeat(60));

  // Define parameter space
  const parameters: ParameterSpec[] = [
    {
      name: 'learning_rate',
      values: [0.001, 0.0001, 0.00001],
      type: 'number',
    },
    {
      name: 'batch_size',
      values: [16, 32, 64],
      type: 'number',
    },
    {
      name: 'optimizer',
      values: ['adam', 'sgd'],
      type: 'string',
    },
  ];

  // Job template for each configuration
  const template: JobTemplate = {
    namePattern: 'Train with lr=${learning_rate}, bs=${batch_size}, opt=${optimizer}',
    type: 'training',
    config: {
      model: 'gpt2',
      learning_rate: '${learning_rate}',
      batch_size: '${batch_size}',
      optimizer: '${optimizer}',
      epochs: 10,
    },
    timeoutMs: 3600000, // 1 hour
  };

  // Fan-out configuration
  const fanOut: FanOutJobConfig = {
    id: 'hyperparameter_search',
    name: 'Hyperparameter Search',
    type: 'fan-out',
    dependsOn: ['preprocess_data'],
    template,
    parameters,
    maxParallelJobs: 6, // Run 6 at a time
    config: {},
  };

  // Fan-in aggregation (select best model)
  const fanIn: FanInJobConfig = {
    id: 'select_best_model',
    name: 'Select Best Model',
    type: 'fan-in',
    dependsOn: [], // Will be set dynamically to all generated jobs
    fanOutJobId: 'hyperparameter_search',
    aggregation: {
      strategy: 'best-metric',
      metricName: 'accuracy',
      ascending: false, // Higher is better
    },
    config: {},
  };

  // Generate combinations
  const combinations = generateParameterCombinations(parameters);
  console.log(`\n✅ Generated ${combinations.length} parameter combinations:`);
  console.log(`   Learning rates: ${parameters[0].values.length}`);
  console.log(`   Batch sizes: ${parameters[1].values.length}`);
  console.log(`   Optimizers: ${parameters[2].values.length}`);
  console.log(`   Total: ${combinations.length} (Cartesian product)`);

  return { fanOut, fanIn };
}

// ============================================================================
// Example 2: A/B Testing
// ============================================================================

export function exampleABTesting(): {
  fanOut: FanOutJobConfig;
  fanIn: FanInJobConfig;
} {
  console.log('\n🔄 Example 2: A/B Testing\n');
  console.log('='.repeat(60));

  // Define variants
  const parameters: ParameterSpec[] = [
    {
      name: 'variant',
      values: ['A', 'B', 'C'],
      type: 'string',
    },
  ];

  // Job template for each variant
  const template: JobTemplate = {
    namePattern: 'Train Variant ${variant}',
    type: 'training',
    config: {
      model: 'variant_${variant}',
      dataset: 'ab_test_${variant}_dataset',
      variant_id: '${variant}',
    },
    timeoutMs: 1800000, // 30 minutes
  };

  // Fan-out configuration
  const fanOut: FanOutJobConfig = {
    id: 'ab_test_variants',
    name: 'A/B Test Variants',
    type: 'fan-out',
    dependsOn: ['prepare_datasets'],
    template,
    parameters,
    config: {},
  };

  // Fan-in aggregation (compare all variants)
  const fanIn: FanInJobConfig = {
    id: 'compare_variants',
    name: 'Compare Variants',
    type: 'fan-in',
    dependsOn: [],
    fanOutJobId: 'ab_test_variants',
    aggregation: {
      strategy: 'collect-all', // Collect all for detailed comparison
    },
    config: {},
  };

  console.log('\n✅ A/B Testing Configuration:');
  console.log(`   Variants: ${parameters[0].values.join(', ')}`);
  console.log(`   Aggregation: Collect all for comparison`);

  return { fanOut, fanIn };
}

// ============================================================================
// Example 3: Data Sharding (Parallel Processing)
// ============================================================================

export function exampleDataSharding(): {
  fanOut: FanOutJobConfig;
  fanIn: FanInJobConfig;
} {
  console.log('\n🔄 Example 3: Data Sharding\n');
  console.log('='.repeat(60));

  // Define shards
  const parameters: ParameterSpec[] = [
    {
      name: 'shard_id',
      values: [0, 1, 2, 3, 4, 5, 6, 7], // 8 shards
      type: 'number',
    },
  ];

  // Job template for each shard
  const template: JobTemplate = {
    namePattern: 'Process Shard ${shard_id}',
    type: 'preprocessing',
    config: {
      operation: 'process_shard',
      shard_id: '${shard_id}',
      total_shards: 8,
    },
    timeoutMs: 600000, // 10 minutes per shard
  };

  // Fan-out configuration
  const fanOut: FanOutJobConfig = {
    id: 'parallel_sharding',
    name: 'Parallel Data Sharding',
    type: 'fan-out',
    dependsOn: ['load_dataset'],
    template,
    parameters,
    maxParallelJobs: 4, // Process 4 shards at a time
    config: {},
  };

  // Fan-in aggregation (combine results)
  const fanIn: FanInJobConfig = {
    id: 'combine_shards',
    name: 'Combine Processed Shards',
    type: 'fan-in',
    dependsOn: [],
    fanOutJobId: 'parallel_sharding',
    aggregation: {
      strategy: 'collect-all', // Collect all shards
    },
    config: {},
  };

  console.log('\n✅ Data Sharding Configuration:');
  console.log(`   Number of shards: ${parameters[0].values.length}`);
  console.log(`   Parallel processing: 4 shards at a time`);

  return { fanOut, fanIn };
}

// ============================================================================
// Example 4: Multi-Model Ensemble
// ============================================================================

export function exampleMultiModelEnsemble(): {
  fanOut: FanOutJobConfig;
  fanIn: FanInJobConfig;
} {
  console.log('\n🔄 Example 4: Multi-Model Ensemble\n');
  console.log('='.repeat(60));

  // Define model types
  const parameters: ParameterSpec[] = [
    {
      name: 'model_type',
      values: ['random_forest', 'xgboost', 'neural_network', 'svm'],
      type: 'string',
    },
  ];

  // Job template for each model
  const template: JobTemplate = {
    namePattern: 'Train ${model_type}',
    type: 'training',
    config: {
      model_type: '${model_type}',
      dataset: 'ensemble_training_data',
    },
    timeoutMs: 2400000, // 40 minutes
  };

  // Fan-out configuration
  const fanOut: FanOutJobConfig = {
    id: 'train_ensemble',
    name: 'Train Ensemble Models',
    type: 'fan-out',
    dependsOn: ['prepare_ensemble_data'],
    template,
    parameters,
    config: {},
  };

  // Fan-in aggregation (majority vote)
  const fanIn: FanInJobConfig = {
    id: 'ensemble_prediction',
    name: 'Ensemble Majority Vote',
    type: 'fan-in',
    dependsOn: [],
    fanOutJobId: 'train_ensemble',
    aggregation: {
      strategy: 'majority-vote', // Majority voting ensemble
    },
    config: {},
  };

  console.log('\n✅ Multi-Model Ensemble:');
  console.log(`   Models: ${parameters[0].values.join(', ')}`);
  console.log(`   Aggregation: Majority vote`);

  return { fanOut, fanIn };
}

// ============================================================================
// Example 5: Custom Aggregation
// ============================================================================

export function exampleCustomAggregation(): AggregationConfig {
  console.log('\n🔄 Example 5: Custom Aggregation\n');
  console.log('='.repeat(60));

  // Custom aggregation: weighted average by confidence
  const customAggregation: AggregationConfig = {
    strategy: 'custom',
    customAggregator: (outputs: unknown[]) => {
      console.log('   Running custom weighted aggregation...');
      
      let totalWeight = 0;
      const weightedMetrics: Record<string, number> = {};

      for (const output of outputs) {
        if (output && typeof output === 'object') {
          const obj = output as Record<string, unknown>;
          const confidence = typeof obj.confidence === 'number' ? obj.confidence : 1.0;
          const metrics = obj.metrics as Record<string, number> | undefined;

          if (metrics) {
            totalWeight += confidence;
            
            for (const [key, value] of Object.entries(metrics)) {
              if (typeof value === 'number') {
                weightedMetrics[key] = (weightedMetrics[key] || 0) + value * confidence;
              }
            }
          }
        }
      }

      // Normalize by total weight
      const result: Record<string, number> = {};
      for (const [key, value] of Object.entries(weightedMetrics)) {
        result[key] = value / totalWeight;
      }

      console.log(`   ✅ Weighted average computed from ${outputs.length} outputs`);
      return { metrics: result, totalWeight };
    },
  };

  console.log('\n✅ Custom Aggregation:');
  console.log('   Strategy: Weighted average by confidence');

  return customAggregation;
}

// ============================================================================
// Example 6: Template Parameter Replacement
// ============================================================================

export function exampleTemplateReplacement(): void {
  console.log('\n🔄 Example 6: Template Parameter Replacement\n');
  console.log('='.repeat(60));

  const template = 'Train model ${model_name} with lr=${learning_rate}';
  const parameters = {
    model_name: 'gpt2',
    learning_rate: 0.001,
  };

  const result = replacePlaceholders(template, parameters);
  console.log('\n✅ String replacement:');
  console.log(`   Template: "${template}"`);
  console.log(`   Result:   "${result}"`);

  // Object replacement
  const configTemplate = {
    model: '${model_name}',
    training: {
      learning_rate: '${learning_rate}',
      batch_size: '${batch_size}',
    },
    paths: ['data/${model_name}', 'checkpoints/${model_name}'],
  };

  const configParams = {
    model_name: 'bert',
    learning_rate: 0.0001,
    batch_size: 32,
  };

  const configResult = replacePlaceholdersInObject(configTemplate, configParams);
  console.log('\n✅ Object replacement:');
  console.log('   Template:', JSON.stringify(configTemplate, null, 2));
  console.log('   Result:', JSON.stringify(configResult, null, 2));
}

// ============================================================================
// Example 7: Complete Workflow
// ============================================================================

export function exampleCompleteWorkflow(): void {
  console.log('\n🔄 Example 7: Complete Fan-Out/Fan-In Workflow\n');
  console.log('='.repeat(60));

  // 1. Define hyperparameter search
  const { fanOut, fanIn } = exampleHyperparameterSearch();

  // 2. Generate dynamic jobs
  console.log('\n📦 Generating dynamic jobs...');
  const { jobs } = generateDynamicJobs(fanOut, ['preprocess_data']);

  console.log(`\n✅ Generated ${jobs.length} jobs:`);
  jobs.slice(0, 3).forEach((job, idx) => {
    console.log(`   ${idx + 1}. ${job.name}`);
    console.log(`      ID: ${job.id}`);
    console.log(`      Config:`, JSON.stringify(job.config, null, 2));
  });
  
  if (jobs.length > 3) {
    console.log(`   ... and ${jobs.length - 3} more jobs`);
  }

  // 3. Simulate outputs
  console.log('\n📊 Simulating job outputs...');
  const outputs = jobs.map((job) => ({
    jobId: job.id,
    accuracy: 0.85 + Math.random() * 0.10, // 85-95%
    loss: 0.1 + Math.random() * 0.05,       // 0.1-0.15
    model_path: `/models/${job.id}`,
  }));

  // 4. Aggregate results
  console.log('\n🔄 Aggregating results...');
  const bestModel = aggregateResults(outputs, fanIn.aggregation);

  console.log('\n✅ Best model selected:');
  console.log(JSON.stringify(bestModel, null, 2));
}

// ============================================================================
// Run All Examples
// ============================================================================

if (require.main === module) {
  console.log('\n' + '='.repeat(80));
  console.log('🔄 Dynamic Parallelism Examples - Phase 2.1');
  console.log('='.repeat(80));

  // Run all examples
  exampleHyperparameterSearch();
  exampleABTesting();
  exampleDataSharding();
  exampleMultiModelEnsemble();
  exampleCustomAggregation();
  exampleTemplateReplacement();
  exampleCompleteWorkflow();

  console.log('\n' + '='.repeat(80));
  console.log('✨ All dynamic parallelism examples completed!');
  console.log('='.repeat(80) + '\n');
}
