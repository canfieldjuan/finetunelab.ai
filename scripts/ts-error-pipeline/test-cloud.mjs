#!/usr/bin/env node
/**
 * Test Cloud API Connection
 * Verifies Ollama Cloud setup and connectivity
 */

import { loadConfig } from './lib/load-env-config.mjs';
import { createClientFromConfig } from './lib/ollama-client.mjs';

console.log('🔍 Testing Ollama Cloud connection...\n');

// Load config (with .env merged)
const config = await loadConfig();

// Check if API key is configured
if (!config.ollama.cloud.api_key || config.ollama.cloud.api_key === 'YOUR_API_KEY_HERE') {
  console.log('❌ Cloud API key not configured.');
  console.log('Run: npm run ts:setup-cloud\n');
  process.exit(1);
}

console.log('Configuration:');
console.log(`  Base URL: ${config.ollama.cloud.base_url}`);
console.log(`  API Key: ${config.ollama.cloud.api_key.substring(0, 20)}...`);
console.log('');

// Test tier 2 cloud model
if (config.cloud_models.tier2) {
  console.log(`Testing tier 2 model: ${config.cloud_models.tier2.model}...`);

  try {
    const client = createClientFromConfig(config.cloud_models.tier2, config.ollama);

    const testPrompt = 'Respond with only the word "SUCCESS" in JSON format: {"status": "SUCCESS"}';
    const response = await client.generate(testPrompt, { maxTokens: 100 });

    console.log(`✅ Tier 2 cloud model works!`);
    console.log(`   Response preview: ${response.substring(0, 100)}...\n`);
  } catch (error) {
    console.log(`❌ Tier 2 cloud model failed: ${error.message}\n`);
  }
}

// Test tier 3 cloud model
if (config.cloud_models.tier3) {
  console.log(`Testing tier 3 model: ${config.cloud_models.tier3.model}...`);

  try {
    const client = createClientFromConfig(config.cloud_models.tier3, config.ollama);

    const testPrompt = 'Respond with only the word "SUCCESS" in JSON format: {"status": "SUCCESS"}';
    const response = await client.generate(testPrompt, { maxTokens: 100 });

    console.log(`✅ Tier 3 cloud model works!`);
    console.log(`   Response preview: ${response.substring(0, 100)}...\n`);
  } catch (error) {
    console.log(`❌ Tier 3 cloud model failed: ${error.message}\n`);
  }
}

// Test local models for comparison
console.log('Testing local models for comparison...');

try {
  const localClient = createClientFromConfig(config.models.tier1, config.ollama);
  const testPrompt = 'Respond with only the word "SUCCESS" in JSON format: {"status": "SUCCESS"}';
  const response = await localClient.generate(testPrompt, { maxTokens: 100 });

  console.log(`✅ Local tier 1 model (${config.models.tier1.model}) works!`);
  console.log(`   Response preview: ${response.substring(0, 100)}...\n`);
} catch (error) {
  console.log(`❌ Local model failed: ${error.message}`);
  console.log('Make sure Ollama is running: ollama serve\n');
}

console.log('✅ Connection test complete!\n');
console.log('📝 Next steps:');
console.log('  - Run full pipeline: npm run ts:pipeline');
console.log('  - Run with parallel execution: npm run ts:fix:parallel\n');
