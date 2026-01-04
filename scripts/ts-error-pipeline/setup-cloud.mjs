#!/usr/bin/env node
/**
 * Setup Cloud API Key
 * Interactive setup for Ollama Cloud configuration
 */

import fs from 'fs/promises';
import readline from 'readline';
import { loadConfig, saveApiKeyToEnv, hasEnvFile } from './lib/load-env-config.mjs';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

console.log('🔧 Ollama Cloud API Setup\n');

// Load current config (with .env merged)
const config = await loadConfig();
const configPath = 'scripts/ts-error-pipeline/config.json';
const usingEnv = await hasEnvFile();

console.log('Current cloud configuration:');
console.log(`  Base URL: ${config.ollama.cloud.base_url}`);
console.log(`  API Key: ${config.ollama.cloud.api_key === 'YOUR_API_KEY_HERE' ? '(not set)' : '(set)'}`);
console.log(`  Config source: ${usingEnv ? '.env file' : 'config.json'}\n`);

const apiKey = await question('Enter your Ollama Cloud API key (or press Enter to skip): ');

if (apiKey && apiKey.trim().length > 0) {
  // Save API key to .env file
  await saveApiKeyToEnv(apiKey.trim(), {
    baseUrl: config.ollama.cloud.base_url,
    timeout: config.ollama.cloud.timeout_ms
  });

  console.log('\n✅ API key saved to .env file');

  // Reload config to get the updated API key
  const updatedConfig = await loadConfig();
  Object.assign(config, updatedConfig);

  // Ask about cloud models to use
  console.log('\nAvailable cloud models for tier 2 (medium complexity):');
  console.log('  1. deepseek-ai/deepseek-r1:671b (recommended)');
  console.log('  2. qwen/qwen2.5-coder:32b-instruct-q8_0');
  console.log('  3. custom (enter model name)');

  const tier2Choice = await question('Select tier 2 model (1-3) [1]: ') || '1';

  if (tier2Choice === '2') {
    config.cloud_models.tier2.model = 'qwen/qwen2.5-coder:32b-instruct-q8_0';
  } else if (tier2Choice === '3') {
    const customModel = await question('Enter custom model name: ');
    if (customModel.trim()) {
      config.cloud_models.tier2.model = customModel.trim();
    }
  }

  console.log('\nAvailable cloud models for tier 3 (complex):');
  console.log('  1. qwen/qwen2.5-coder:32b-instruct-q8_0 (recommended)');
  console.log('  2. deepseek-ai/deepseek-r1:671b');
  console.log('  3. custom (enter model name)');

  const tier3Choice = await question('Select tier 3 model (1-3) [1]: ') || '1';

  if (tier3Choice === '2') {
    config.cloud_models.tier3.model = 'deepseek-ai/deepseek-r1:671b';
  } else if (tier3Choice === '3') {
    const customModel = await question('Enter custom model name: ');
    if (customModel.trim()) {
      config.cloud_models.tier3.model = customModel.trim();
    }
  }

  // Ask about execution mode
  console.log('\nExecution modes:');
  console.log('  1. sequential - Run tiers one after another (slower, lower cost)');
  console.log('  2. parallel - Run all tiers at once (faster, higher cost)');
  console.log('  3. hybrid - Local for tier 1, cloud for tier 2/3 in parallel');

  const modeChoice = await question('Select execution mode (1-3) [2]: ') || '2';

  if (modeChoice === '1') {
    config.execution.mode = 'sequential';
  } else if (modeChoice === '3') {
    config.execution.mode = 'hybrid';
    // Set tier 2 and 3 to use cloud
    config.models.tier2.provider = 'cloud';
    config.models.tier3.provider = 'cloud';
  } else {
    config.execution.mode = 'parallel';
  }

  // Ask about fallback
  const useFallback = await question('Use cloud as fallback if local fails? (y/n) [y]: ') || 'y';
  config.execution.use_cloud_fallback = useFallback.toLowerCase() === 'y';

  // Save config (model settings only, not API key)
  const baseConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));
  baseConfig.cloud_models = config.cloud_models;
  baseConfig.models = config.models;
  baseConfig.execution = config.execution;
  await fs.writeFile(configPath, JSON.stringify(baseConfig, null, 2));

  console.log('\n✅ Configuration saved!');
  console.log('\n📍 API key stored in: .env (not committed to git)');
  console.log('📍 Model settings stored in: config.json');
  console.log('\nCloud models configured:');
  console.log(`  Tier 2: ${config.cloud_models.tier2.model}`);
  console.log(`  Tier 3: ${config.cloud_models.tier3.model}`);
  console.log(`\nExecution mode: ${config.execution.mode}`);
  console.log(`Cloud fallback: ${config.execution.use_cloud_fallback ? 'enabled' : 'disabled'}`);

  console.log('\n📝 Next steps:');
  console.log('  1. Test connection: npm run ts:test-cloud');
  console.log('  2. Run pipeline: npm run ts:pipeline');
  console.log('  3. For parallel execution: npm run ts:fix:parallel\n');
  console.log('💡 Tip: Your API key is safely stored in .env and will not be committed to git.');
} else {
  console.log('\nℹ️  API key not provided. Cloud features will not be available.');
  console.log('Run this script again when you have your API key.\n');
}

rl.close();
