// Test Node SDK with live API calls (ES module)
import { FinetuneLabClient } from './dist/index.js';

const API_KEY = 'wak_7ug7yOXttPvAlEnCDEWPfina4eShUvZd';
const BASE_URL = 'http://localhost:3000';
const JOB_ID = '38d9a037-9c68-4bb7-b1aa-d91de34da720';

console.log('=== Testing Node SDK - Live API Calls ===\n');

try {
  // Initialize client
  console.log('1. Initializing client...');
  const client = new FinetuneLabClient({ apiKey: API_KEY, baseUrl: BASE_URL });
  console.log('   ✓ Client initialized\n');

  // Test get() method
  console.log('2. Testing trainingPredictions.get()...');
  const predictions = await client.trainingPredictions.get(JOB_ID, { limit: 2 });
  console.log(`   ✓ Retrieved ${predictions.predictions.length} predictions`);
  console.log(`   ✓ Total count: ${predictions.total_count}`);
  console.log(`   ✓ Epochs: ${predictions.epoch_count}\n`);

  // Test epochs() method
  console.log('3. Testing trainingPredictions.epochs()...');
  const epochs = await client.trainingPredictions.epochs(JOB_ID);
  console.log(`   ✓ Retrieved ${epochs.epochs.length} epoch summaries`);
  console.log(`   ✓ Epochs: ${JSON.stringify(epochs.epochs, null, 2)}\n`);

  // Test trends() method
  console.log('4. Testing trainingPredictions.trends()...');
  const trends = await client.trainingPredictions.trends(JOB_ID);
  console.log(`   ✓ Retrieved ${trends.trends.length} trend points`);
  console.log(`   ✓ Overall improvement: ${trends.overall_improvement ?? 'N/A'}\n`);

  console.log('✅ All API calls successful!');
  console.log('   Node SDK is fully functional!');

} catch (error) {
  console.error('\n✗ Test failed:', error.message);
  if (error.statusCode) {
    console.error(`   Status code: ${error.statusCode}`);
  }
  process.exit(1);
}
