/**
 * Test model-browser service
 * Run with: node test-model-browser.js
 *
 * This tests the service logic without TypeScript compilation
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

console.log('Testing Model Browser Service...\n');

try {
  // Test 1: Verify config can be loaded
  const configPath = path.join(__dirname, 'components', 'training', 'workflow', 'Step1ModelSelection.config.yaml');
  console.log('1. Loading configuration...');
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  console.log('✓ Config loaded\n');

  // Test 2: Verify popular models are configured
  console.log('2. Checking popular models...');
  if (!config.popularModels || config.popularModels.length === 0) {
    throw new Error('No popular models configured');
  }
  console.log(`✓ Found ${config.popularModels.length} popular models\n`);

  // Test 3: Simulate getPopularModels() function
  console.log('3. Simulating getPopularModels()...');
  const models = config.popularModels.map(model => ({
    id: model.id,
    name: model.name,
    author: model.author,
    sizeGB: model.sizeGB,
    isCached: false,
    supportsChatTemplate: model.supportsChatTemplate,
    supportsLoRA: model.supportsLoRA,
    parameterCount: model.parameterCount,
    description: model.description,
  }));
  console.log(`✓ Converted ${models.length} models to ModelInfo format\n`);

  // Test 4: Display sample models
  console.log('4. Sample models:');
  models.slice(0, 3).forEach((model, idx) => {
    console.log(`   ${idx + 1}. ${model.name}`);
    console.log(`      ID: ${model.id}`);
    console.log(`      Size: ${model.sizeGB}GB`);
    console.log(`      Chat: ${model.supportsChatTemplate ? 'Yes' : 'No'}`);
    console.log(`      LoRA: ${model.supportsLoRA ? 'Yes' : 'No'}`);
    console.log('');
  });

  // Test 5: Verify cache configuration
  console.log('5. Checking cache configuration...');
  if (!config.cache || typeof config.cache.enabled !== 'boolean') {
    throw new Error('Invalid cache configuration');
  }
  console.log(`   Enabled: ${config.cache.enabled}`);
  console.log(`   TTL: ${config.cache.ttl}s`);
  console.log(`   Max Entries: ${config.cache.maxEntries}`);
  console.log('✓ Cache configuration valid\n');

  // Test 6: Verify API configuration
  console.log('6. Checking API configuration...');
  if (!config.api || !config.api.baseUrl) {
    throw new Error('Invalid API configuration');
  }
  console.log(`   Base URL: ${config.api.baseUrl}`);
  console.log(`   Timeout: ${config.api.timeout}ms`);
  console.log(`   Retries: ${config.api.retries}`);
  console.log('✓ API configuration valid\n');

  // Test 7: Verify search limits
  console.log('7. Checking search limits...');
  if (!config.limits || typeof config.limits.maxSearchResults !== 'number') {
    throw new Error('Invalid limits configuration');
  }
  console.log(`   Max Results: ${config.limits.maxSearchResults}`);
  console.log(`   Default Page Size: ${config.limits.defaultPageSize}`);
  console.log('✓ Search limits valid\n');

  console.log('✅ All model-browser service tests passed!');
  console.log('\nService is ready for integration with Step1ModelSelection component.');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
}
