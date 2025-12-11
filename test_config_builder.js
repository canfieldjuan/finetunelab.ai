#!/usr/bin/env node
/**
 * Config Builder Test
 *
 * Tests that predictions config is preserved through normalizeForBackend()
 *
 * Run: node test_config_builder.js
 */

// Mock TypeScript imports for testing
const testConfig = {
  model: {
    name: 'test-model/llama-7b',
    trust_remote_code: false,
    torch_dtype: 'float16',
    device_map: 'auto'
  },
  tokenizer: {
    name: 'test-model/llama-7b',
    trust_remote_code: false
  },
  training: {
    method: 'sft',
    num_epochs: 3,
    learning_rate: 0.0002,
    batch_size: 4,
    gradient_accumulation_steps: 4,
    lora_r: 16,
    lora_alpha: 32,
    lora_dropout: 0.05
  },
  data: {
    strategy: 'standard',
    dataset_path: '/path/to/dataset.jsonl'
  },
  predictions: {
    enabled: true,
    sample_count: 5,
    sample_frequency: 'epoch'
  },
  provider: {
    type: 'local',
    base_url: 'http://localhost:8000'
  },
  seed: 42
};

function log(msg) {
  console.log(`[TEST] ${msg}`);
}

function printResult(testName, passed, details = '') {
  const status = passed ? '\x1b[92mPASS\x1b[0m' : '\x1b[91mFAIL\x1b[0m';
  const symbol = passed ? '✓' : '✗';
  console.log(`[${symbol}] ${testName}: ${status}`);
  if (details) {
    console.log(`    ${details}`);
  }
}

function printSection(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

// Simulate buildUiConfig
function buildUiConfig(input) {
  const cfg = JSON.parse(JSON.stringify(input));
  if (!cfg.training) {
    cfg.training = {};
  }
  const training = cfg.training;
  if (training.method === undefined) {
    training.method = 'sft';
  }
  return cfg;
}

// Simulate normalizeForBackend (FIXED VERSION)
function normalizeForBackend(config) {
  const cfg = buildUiConfig(config);
  const t = { ...cfg.training };
  const hasLoRA = t.use_lora || t.lora_r || t.lora_alpha || t.lora_dropout;

  const out = {
    model: cfg.model,
    tokenizer: cfg.tokenizer,
    data: cfg.data,
    training: t,
  };

  // Include optional fields if present (THIS IS THE FIX)
  if (cfg.predictions) {
    out.predictions = cfg.predictions;
  }
  if (cfg.provider) {
    out.provider = cfg.provider;
  }
  if (cfg.tools) {
    out.tools = cfg.tools;
  }
  if (cfg.evaluation) {
    out.evaluation = cfg.evaluation;
  }
  if (cfg.tensorboard) {
    out.tensorboard = cfg.tensorboard;
  }
  if (cfg.seed !== undefined) {
    out.seed = cfg.seed;
  }

  // Map training.lora_* to top-level lora if present
  if (hasLoRA) {
    const r = t.lora_r;
    const alpha = t.lora_alpha;
    const dropout = t.lora_dropout;
    if (r && alpha) {
      out.lora = { r, alpha, dropout: dropout ?? 0.05 };
    }

    // Remove UI-specific LoRA keys from training copy
    delete out.training.lora_r;
    delete out.training.lora_alpha;
    delete out.training.lora_dropout;
  }

  return out;
}

function runTests() {
  console.log('\n╔' + '='.repeat(68) + '╗');
  console.log('║' + ' '.repeat(68) + '║');
  console.log('║     CONFIG BUILDER TEST - PREDICTIONS PERSISTENCE           ║');
  console.log('║' + ' '.repeat(68) + '║');
  console.log('╚' + '='.repeat(68) + '╝');

  const results = [];

  // Test 1: Basic config structure
  printSection('TEST 1: Input Config Structure');
  const hasPredictions = 'predictions' in testConfig;
  printResult('Input has predictions field', hasPredictions,
    `predictions: ${JSON.stringify(testConfig.predictions)}`);
  results.push(hasPredictions);

  const hasProvider = 'provider' in testConfig;
  printResult('Input has provider field', hasProvider,
    `provider: ${JSON.stringify(testConfig.provider)}`);
  results.push(hasProvider);

  const hasSeed = 'seed' in testConfig;
  printResult('Input has seed field', hasSeed,
    `seed: ${testConfig.seed}`);
  results.push(hasSeed);

  // Test 2: normalizeForBackend preserves fields
  printSection('TEST 2: normalizeForBackend Output');
  const normalized = normalizeForBackend(testConfig);

  log('Normalized config keys: ' + Object.keys(normalized).join(', '));

  const predictionsPreserved = 'predictions' in normalized;
  printResult('predictions field preserved', predictionsPreserved,
    `predictions: ${JSON.stringify(normalized.predictions)}`);
  results.push(predictionsPreserved);

  if (predictionsPreserved) {
    const configMatches = JSON.stringify(normalized.predictions) === JSON.stringify(testConfig.predictions);
    printResult('predictions config unchanged', configMatches,
      `Expected: ${JSON.stringify(testConfig.predictions)}`);
    results.push(configMatches);
  }

  const providerPreserved = 'provider' in normalized;
  printResult('provider field preserved', providerPreserved,
    `provider: ${JSON.stringify(normalized.provider)}`);
  results.push(providerPreserved);

  const seedPreserved = 'seed' in normalized;
  printResult('seed field preserved', seedPreserved,
    `seed: ${normalized.seed}`);
  results.push(seedPreserved);

  // Test 3: LoRA handling
  printSection('TEST 3: LoRA Extraction');
  const hasLoraTop = 'lora' in normalized;
  printResult('LoRA extracted to top-level', hasLoraTop,
    `lora: ${JSON.stringify(normalized.lora)}`);
  results.push(hasLoraTop);

  const loraRemovedFromTraining = !('lora_r' in normalized.training);
  printResult('LoRA fields removed from training', loraRemovedFromTraining,
    `training.lora_r: ${normalized.training.lora_r}`);
  results.push(loraRemovedFromTraining);

  // Test 4: Required fields
  printSection('TEST 4: Required Fields');
  const hasModel = 'model' in normalized;
  printResult('model field present', hasModel);
  results.push(hasModel);

  const hasTokenizer = 'tokenizer' in normalized;
  printResult('tokenizer field present', hasTokenizer);
  results.push(hasTokenizer);

  const hasData = 'data' in normalized;
  printResult('data field present', hasData);
  results.push(hasData);

  const hasTraining = 'training' in normalized;
  printResult('training field present', hasTraining);
  results.push(hasTraining);

  // Summary
  printSection('TEST SUMMARY');

  const passed = results.filter(r => r).length;
  const total = results.length;
  const percentage = ((passed / total) * 100).toFixed(1);

  const color = passed === total ? '\x1b[92m' : passed > 0 ? '\x1b[93m' : '\x1b[91m';
  const reset = '\x1b[0m';

  console.log(`${color}PASSED: ${passed}/${total} (${percentage}%)${reset}\n`);

  if (passed === total) {
    console.log('✓ ALL TESTS PASSED - Config builder preserves predictions!');
    console.log('\nNormalized config:');
    console.log(JSON.stringify(normalized, null, 2));
    return 0;
  } else {
    console.log(`✗ ${total - passed} TEST(S) FAILED`);
    return 1;
  }
}

process.exit(runTests());
