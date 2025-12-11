/**
 * Simple test to verify config loader works
 * Run with: node test-config-loader.js
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

console.log('Testing YAML Config Loader...\n');

try {
  // Test 1: Load Step1ModelSelection config
  const configPath = path.join(
    __dirname,
    'components',
    'training',
    'workflow',
    'Step1ModelSelection.config.yaml'
  );

  console.log(`1. Checking if config file exists: ${configPath}`);
  if (!fs.existsSync(configPath)) {
    throw new Error('Config file not found!');
  }
  console.log('✓ Config file exists\n');

  console.log('2. Reading config file...');
  const fileContent = fs.readFileSync(configPath, 'utf8');
  console.log(`✓ File read successfully (${fileContent.length} bytes)\n`);

  console.log('3. Parsing YAML...');
  const config = yaml.load(fileContent);
  console.log('✓ YAML parsed successfully\n');

  console.log('4. Validating structure...');
  if (!config.api) throw new Error('Missing api section');
  if (!config.popularModels) throw new Error('Missing popularModels section');
  if (!config.limits) throw new Error('Missing limits section');
  console.log('✓ Structure is valid\n');

  console.log('5. Checking popular models...');
  console.log(`   Found ${config.popularModels.length} popular models:`);
  config.popularModels.forEach((model, idx) => {
    console.log(`   ${idx + 1}. ${model.name} (${model.sizeGB}GB)`);
  });
  console.log('');

  console.log('6. Checking API configuration...');
  console.log(`   Base URL: ${config.api.baseUrl}`);
  console.log(`   Timeout: ${config.api.timeout}ms`);
  console.log(`   Retries: ${config.api.retries}`);
  console.log('');

  console.log('✅ All tests passed!');
  console.log('\nConfig is ready to use.');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
}
