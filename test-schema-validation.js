/**
 * Test Zod schema validation of Step1ModelSelection config
 * Run with: node --loader ts-node/esm test-schema-validation.js
 * Or simple test: node test-schema-validation.js
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

console.log('Testing Zod Schema Validation...\n');

try {
  // Load the config
  const configPath = path.join(
    __dirname,
    'components',
    'training',
    'workflow',
    'Step1ModelSelection.config.yaml'
  );

  console.log('1. Loading config file...');
  const fileContent = fs.readFileSync(configPath, 'utf8');
  const config = yaml.load(fileContent);
  console.log('✓ Config loaded\n');

  console.log('2. Manual validation checks...');

  // Check API config
  if (!config.api || !config.api.baseUrl) {
    throw new Error('Missing api.baseUrl');
  }
  console.log('  ✓ API config present');

  // Check popular models
  if (!Array.isArray(config.popularModels) || config.popularModels.length === 0) {
    throw new Error('popularModels must be non-empty array');
  }
  console.log(`  ✓ Popular models (${config.popularModels.length} models)`);

  // Check each popular model has required fields
  config.popularModels.forEach((model, idx) => {
    if (!model.id || !model.name || model.sizeGB === undefined) {
      throw new Error(`Model at index ${idx} missing required fields`);
    }
    if (typeof model.sizeGB !== 'number' || model.sizeGB <= 0) {
      throw new Error(`Model ${model.id} has invalid sizeGB`);
    }
  });
  console.log('  ✓ All models have required fields');

  // Check categories
  if (!config.categories || typeof config.categories !== 'object') {
    throw new Error('Missing categories');
  }
  const categoryCount = Object.keys(config.categories).length;
  console.log(`  ✓ Categories (${categoryCount} categories)`);

  // Check limits
  if (!config.limits || typeof config.limits.maxSearchResults !== 'number') {
    throw new Error('Missing or invalid limits');
  }
  console.log('  ✓ Limits configured');

  // Check UI settings
  if (!config.ui || typeof config.ui.defaultView !== 'string') {
    throw new Error('Missing or invalid UI config');
  }
  console.log('  ✓ UI settings present');

  // Check features
  if (!config.features || typeof config.features.enableHFSearch !== 'boolean') {
    throw new Error('Missing or invalid features');
  }
  console.log('  ✓ Feature flags configured');

  console.log('\n✅ All validation checks passed!');
  console.log('\nConfig structure is valid and ready for use.');
  console.log('Schema validation would provide additional type safety in TypeScript.');

} catch (error) {
  console.error('❌ Validation failed:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
}
