// Dataset Manager Tool - Basic Tests
// Date: October 21, 2025

// IMPORTANT: Load environment variables before any other imports
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables before any other imports
const envPath = path.resolve(__dirname, '../../../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error(`[Test Setup] FATAL: Could not load .env file from ${envPath}`, result.error);
  process.exit(1);
}
console.log('[Test Setup] Environment variables loaded successfully.');


// import datasetManagerTool from './index'; // Moved to dynamic import

export async function testDatasetManager() {
  const { default: datasetManagerTool } = await import('./index');
  console.log('Testing Dataset Manager Tool...\n');
  
  // Get test user ID from environment
  const testUserId = process.env.TEST_USER_ID;
  
  if (!testUserId) {
    console.error('❌ FATAL: TEST_USER_ID environment variable is required');
    console.log('Please set TEST_USER_ID to a valid user UUID in your .env file');
    console.log('Example: TEST_USER_ID=your-user-uuid-here');
    return;
  }
  
  console.log(`Using test user ID: ${testUserId}\n`);
  
  // Test 1: List operation
  console.log('Test 1: List datasets');
  try {
    const listResult = await datasetManagerTool.execute({
      operation: 'list',
      user_id: testUserId,
    });
    console.log('Result:', listResult);
    console.log('PASS\n');
  } catch (error) {
    console.error('FAIL:', error);
  }
  
  // Test 2: Stats operation
  console.log('Test 2: Get dataset stats');
  try {
    const statsResult = await datasetManagerTool.execute({
      operation: 'stats',
      user_id: testUserId,
    });
    console.log('Result:', statsResult);
    console.log('PASS\n');
  } catch (error) {
    console.error('FAIL:', error);
  }
  
  // Test 3: Validate operation
  console.log('Test 3: Validate dataset');
  try {
    const validateResult = await datasetManagerTool.execute({
      operation: 'validate',
      user_id: testUserId,
    });
    console.log('Result:', validateResult);
    console.log('PASS\n');
  } catch (error) {
    console.error('FAIL:', error);
  }
  
  // Test 4: Export operation
  console.log('Test 4: Export dataset');
  try {
    const exportResult = await datasetManagerTool.execute({
      operation: 'export',
      user_id: testUserId,
      export_format: 'json',
      limit: 10,
    }) as {
      operation: string;
      format: string;
      total_records: number;
      data: unknown[];
    };
    console.log('Result:', {
      operation: exportResult.operation,
      format: exportResult.format,
      total_records: exportResult.total_records,
      sample_record: exportResult.data?.[0] || null,
    });
    console.log('PASS\n');
  } catch (error) {
    console.error('FAIL:', error);
  }
  
  // Test 5: Invalid operation
  console.log('Test 5: Invalid operation (should fail)');
  try {
    await datasetManagerTool.execute({
      operation: 'invalid_op',
    });
    console.log('FAIL: Should have thrown error\n');
  } catch (error) {
    console.log('PASS: Correctly rejected invalid operation');
    console.log('Error:', (error as Error).message, '\n');
  }
  
  // Test 6: Missing operation
  console.log('Test 6: Missing operation (should fail)');
  try {
    await datasetManagerTool.execute({});
    console.log('FAIL: Should have thrown error\n');
  } catch (error) {
    console.log('PASS: Correctly rejected missing operation');
    console.log('Error:', (error as Error).message, '\n');
  }
  
  console.log('All tests completed!');
}

// Self-executing function to run tests
(async () => {
  try {
    await testDatasetManager();
  } catch (error) {
    console.error('Test execution failed with an unhandled error:', error);
    process.exit(1);
  }
})();
