// Test script for datasets endpoint
// Tests the optimized /api/training/[id]/datasets endpoint

const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testDatasetsEndpoint() {
  console.log('=== Testing Datasets Endpoint ===\n');

  if (!TEST_AUTH_TOKEN) {
    console.error('ERROR: TEST_AUTH_TOKEN environment variable not set');
    console.log('Set it with: $env:TEST_AUTH_TOKEN="your-token"');
    process.exit(1);
  }

  console.log('1. Fetching training configs to find one with datasets...');

  try {
    // First, get list of training configs
    const configsResponse = await fetch(`${BASE_URL}/api/training`, {
      headers: {
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!configsResponse.ok) {
      throw new Error(`Failed to fetch configs: ${configsResponse.status}`);
    }

    const configsData = await configsResponse.json();
    console.log(`Found ${configsData.configs?.length || 0} training configs\n`);

    if (!configsData.configs || configsData.configs.length === 0) {
      console.log('No training configs found. Create one first with datasets attached.');
      return;
    }

    // Use the first config for testing
    const testConfig = configsData.configs[0];
    console.log(`2. Testing datasets endpoint for config: ${testConfig.id}`);
    console.log(`   Config name: ${testConfig.name}\n`);

    // Test the datasets endpoint
    const datasetsResponse = await fetch(`${BASE_URL}/api/training/${testConfig.id}/datasets`, {
      headers: {
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!datasetsResponse.ok) {
      throw new Error(`Datasets endpoint failed: ${datasetsResponse.status}`);
    }

    const datasetsData = await datasetsResponse.json();
    console.log('3. Datasets endpoint response:');
    console.log(JSON.stringify(datasetsData, null, 2));
    console.log('');

    // Verify response structure
    console.log('4. Verification:');
    if (!datasetsData.success) {
      console.log('   ❌ Response does not have success=true');
      return;
    }
    console.log('   ✅ Response has success=true');

    if (!Array.isArray(datasetsData.datasets)) {
      console.log('   ❌ datasets is not an array');
      return;
    }
    console.log(`   ✅ datasets is an array with ${datasetsData.datasets.length} items`);

    // Check each dataset has required fields
    datasetsData.datasets.forEach((dataset, index) => {
      console.log(`\n   Dataset ${index + 1}:`);
      console.log(`   - id: ${dataset.id ? '✅' : '❌'} ${dataset.id || 'missing'}`);
      console.log(`   - name: ${dataset.name ? '✅' : '❌'} ${dataset.name || 'missing'}`);
      console.log(`   - storage_path: ${dataset.storage_path ? '✅' : '❌'} ${dataset.storage_path || 'missing'}`);
      console.log(`   - size: ${dataset.size !== undefined ? '✅' : '❌'} ${dataset.size || 0} bytes`);
      console.log(`   - created_at: ${dataset.created_at ? '✅' : '❌'} ${dataset.created_at || 'missing'}`);
    });

    console.log('\n✅ Datasets endpoint test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testDatasetsEndpoint();
