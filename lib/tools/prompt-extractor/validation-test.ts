/**
 * Test script to verify endpoint validation
 * Run with: npx tsx lib/tools/prompt-extractor/validation-test.ts
 */

import { executeBatch } from './prompt-extractor.service';

async function testEndpointValidation() {
  console.log('Testing endpoint validation...\n');

  // Test 1: Should FAIL - local chat endpoint
  const badEndpoints = [
    'http://localhost:3000/api/chat',
    'http://127.0.0.1:3000/api/chat',
    'https://localhost/api/chat',
    '/api/chat',
  ];

  for (const endpoint of badEndpoints) {
    console.log(`\n❌ Testing BAD endpoint: ${endpoint}`);
    try {
      await executeBatch({
        prompts: ['test'],
        modelEndpoint: endpoint,
      });
      console.error('  ⚠️ VALIDATION FAILED - Should have thrown error!');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot use /api/chat')) {
        console.log('  ✅ Correctly rejected:', error.message.split('\n')[0]);
      } else {
        console.error('  ⚠️ Wrong error:', error);
      }
    }
  }

  // Test 2: Should PASS - valid external endpoints
  const goodEndpoints = [
    'https://api.openai.com/v1/chat/completions',
    'https://api-inference.huggingface.co/models/gpt2',
    'https://api.anthropic.com/v1/messages',
  ];

  console.log('\n\n✅ Testing VALID endpoints (should not throw):');
  for (const endpoint of goodEndpoints) {
    console.log(`\n  Testing: ${endpoint}`);
    try {
      // We expect this to fail at the fetch stage (no API key), but validation should pass
      await executeBatch({
        prompts: ['test'],
        modelEndpoint: endpoint,
        requestOptions: { timeout: 100 }, // Short timeout to fail fast
      });
      console.log('  ⚠️ Unexpected success (probably mock data)');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot use /api/chat')) {
        console.error('  ❌ VALIDATION ERROR - Should have passed!');
      } else {
        // Expected - fetch will fail, but validation passed
        console.log('  ✅ Validation passed (fetch failed as expected)');
      }
    }
  }

  console.log('\n\n✅ Endpoint validation tests complete!\n');
}

// Run tests
testEndpointValidation().catch(console.error);
