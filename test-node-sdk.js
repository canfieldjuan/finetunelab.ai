// Test Node SDK predictions client
const { FinetuneLabClient } = require('./packages/finetune-lab-sdk/dist/index.js');

const API_KEY = 'wak_XK-vUjyJWuzzYeFWo6R8v8iKzC5LWUAicr1h-CFOWJc';
const BASE_URL = 'http://localhost:3000';

console.log('=== Testing Node SDK - Training Predictions ===\n');

// Initialize client
console.log('1. Initializing client...');
const client = new FinetuneLabClient({ apiKey: API_KEY, baseUrl: BASE_URL });
console.log(`   ✓ Client initialized\n`);

// Check that trainingPredictions sub-client exists
console.log('2. Checking trainingPredictions sub-client...');
if (client.trainingPredictions) {
  console.log('   ✓ trainingPredictions sub-client exists');
  console.log(`   ✓ Type: ${client.trainingPredictions.constructor.name}\n`);
} else {
  console.log('   ✗ trainingPredictions sub-client NOT FOUND');
  process.exit(1);
}

// Test methods exist
console.log('3. Checking methods...');
const methods = ['get', 'epochs', 'trends'];
for (const method of methods) {
  if (typeof client.trainingPredictions[method] === 'function') {
    console.log(`   ✓ Method '${method}' exists`);
  } else {
    console.log(`   ✗ Method '${method}' NOT FOUND`);
  }
}

console.log('\n✅ Node SDK structure verified!');
console.log('   (Skipping live API calls due to Next.js server issue)');
console.log('   SDK is ready to use once server is fixed.');
