#!/usr/bin/env node
/**
 * Real-world user scenario: Monitor training predictions
 * A data scientist wants to track their model's predictions during training
 */

import { FinetuneLabClient } from './dist/index.js';

// User's API key (with 'training' scope)
const API_KEY = 'wak_7ug7yOXttPvAlEnCDEWPfina4eShUvZd';
const BASE_URL = 'http://localhost:3000';

// The training job they're monitoring
const JOB_ID = '38d9a037-9c68-4bb7-b1aa-d91de34da720';

console.log("=".repeat(70));
console.log("📊 TRAINING PREDICTIONS MONITORING");
console.log("=".repeat(70));
console.log(`\nMonitoring job: ${JOB_ID}`);
console.log(`Using API: ${BASE_URL}\n`);

// Initialize the SDK
const client = new FinetuneLabClient({ apiKey: API_KEY, baseUrl: BASE_URL });

try {
  // Scenario 1: Check overall training progress
  console.log("1️⃣  Checking training progress across epochs...");
  console.log("-".repeat(70));

  const epochsData = await client.trainingPredictions.epochs(JOB_ID);
  console.log(`✓ Training has completed ${epochsData.epochs.length} epochs\n`);

  for (const epochSummary of epochsData.epochs) {
    console.log(`   Epoch ${epochSummary.epoch}:`);
    console.log(`   • Predictions logged: ${epochSummary.prediction_count}`);
    console.log(`   • Latest step: ${epochSummary.latest_step}`);
    console.log();
  }

  // Scenario 2: View recent predictions from latest epoch
  console.log("\n2️⃣  Viewing recent predictions from latest epoch...");
  console.log("-".repeat(70));

  const latestEpoch = epochsData.epochs[epochsData.epochs.length - 1].epoch;
  const predictions = await client.trainingPredictions.get(JOB_ID, {
    epoch: latestEpoch,
    limit: 5
  });

  console.log(`✓ Retrieved ${predictions.predictions.length} recent predictions`);
  console.log(`   (Total: ${predictions.total_count} predictions across ${predictions.epoch_count} epochs)\n`);

  for (let i = 0; i < Math.min(3, predictions.predictions.length); i++) {
    const pred = predictions.predictions[i];
    console.log(`   Prediction ${i + 1}:`);
    console.log(`   • Step: ${pred.step}`);
    console.log(`   • Prompt: ${pred.prompt.substring(0, 60)}...`);
    console.log(`   • Ground truth: ${pred.ground_truth?.substring(0, 60) || 'N/A'}...`);
    console.log(`   • Model output: ${pred.prediction.substring(0, 60)}...`);
    console.log();
  }

  // Scenario 3: Analyze quality trends over time
  console.log("\n3️⃣  Analyzing quality trends across training...");
  console.log("-".repeat(70));

  const trends = await client.trainingPredictions.trends(JOB_ID);
  console.log(`✓ Retrieved quality metrics for ${trends.trends.length} checkpoints\n`);

  for (const trend of trends.trends) {
    console.log(`   Epoch ${trend.epoch} (Step ${trend.step}):`);
    console.log(`   • Samples evaluated: ${trend.sample_count}`);

    const hasMetrics = trend.avg_exact_match !== null ||
                      trend.avg_char_error_rate !== null ||
                      trend.avg_word_overlap !== null ||
                      trend.validation_pass_rate !== null;

    if (hasMetrics) {
      if (trend.avg_exact_match !== null) {
        console.log(`   • Exact match rate: ${(trend.avg_exact_match * 100).toFixed(2)}%`);
      }
      if (trend.avg_char_error_rate !== null) {
        console.log(`   • Character error rate: ${trend.avg_char_error_rate.toFixed(3)}`);
      }
      if (trend.avg_word_overlap !== null) {
        console.log(`   • Word overlap: ${(trend.avg_word_overlap * 100).toFixed(2)}%`);
      }
      if (trend.validation_pass_rate !== null) {
        console.log(`   • Validation pass rate: ${(trend.validation_pass_rate * 100).toFixed(2)}%`);
      }
    } else {
      console.log(`   • Quality metrics: Not yet calculated`);
    }
    console.log();
  }

  if (trends.overall_improvement !== null) {
    const sign = trends.overall_improvement >= 0 ? '+' : '';
    console.log(`   📈 Overall improvement: ${sign}${(trends.overall_improvement * 100).toFixed(2)}%`);
  } else {
    console.log(`   ℹ️  Overall improvement: Metrics not yet available`);
  }

  // Scenario 4: Paginate through all predictions
  console.log("\n4️⃣  Demonstrating pagination through all predictions...");
  console.log("-".repeat(70));

  const pageSize = 10;
  const page1 = await client.trainingPredictions.get(JOB_ID, { limit: pageSize, offset: 0 });
  const page2 = await client.trainingPredictions.get(JOB_ID, { limit: pageSize, offset: pageSize });

  console.log(`✓ Page 1: Retrieved ${page1.predictions.length} predictions`);
  console.log(`✓ Page 2: Retrieved ${page2.predictions.length} predictions`);
  console.log(`   Total available: ${page1.total_count} predictions`);
  console.log(`   Pages needed: ${Math.ceil(page1.total_count / pageSize)}`);

  console.log("\n" + "=".repeat(70));
  console.log("✅ Training monitoring complete!");
  console.log("=".repeat(70));
  console.log("\n💡 Use case demonstrated:");
  console.log("   • Monitor training progress across epochs");
  console.log("   • Inspect individual predictions");
  console.log("   • Track quality metrics over time");
  console.log("   • Paginate through large prediction sets");
  console.log();

} catch (error) {
  console.error(`\n✗ Error: ${error.message}`);
  if (error.statusCode) {
    console.error(`   Status code: ${error.statusCode}`);
  }
  process.exit(1);
}
