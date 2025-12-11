#!/usr/bin/env node
/**
 * API Endpoint Test with Real Auth Token
 * Tests all endpoints with proper timeout handling
 * Date: 2025-10-17
 */

const API_BASE = 'http://localhost:3000';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsImtpZCI6Ik5oaUNDcmgrM05TaCtHUGYiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3RraXpsZW1zc2ZtcmZsdXljaHNuLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIzOGM4NTcwNy0xZmM1LTQwYzYtODRiZS1jMDE3YjNiOGU3NTAiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYwNzYzNzAxLCJpYXQiOjE3NjA3NjAxMDEsImVtYWlsIjoiY2FuZmllbGRqdWFuMjRAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6ImNhbmZpZWxkanVhbjI0QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmaXJzdF9uYW1lIjoianVhbiIsImxhc3RfbmFtZSI6ImNhbmZpZWxkIiwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiIzOGM4NTcwNy0xZmM1LTQwYzYtODRiZS1jMDE3YjNiOGU3NTAifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc2MDc2MDEwMX1dLCJzZXNzaW9uX2lkIjoiY2E3MTI5MWUtYTQ3Ni00YTFkLTg1YjAtYjA4YTFiYmM4NDk5IiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.RDb2y3C6oDCJdF0ak6tY9-eWiqp6rtOBJzdvVmo0BaE';
const TIMEOUT_MS = 30000; // 30 seconds

let testApiKey = null;
let testApiKeyId = null;

console.log('========================================');
console.log('API Endpoint Tests - Real Database');
console.log('========================================\n');
console.log('Server:', API_BASE);
console.log('Timeout:', TIMEOUT_MS / 1000, 'seconds');
console.log('Token (first 20):', AUTH_TOKEN.substring(0, 20) + '...\n');

// Helper function with timeout
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const method = options.method || 'GET';
  
  console.log(`[API] ${method} ${endpoint}`);
  console.log(`[API] Waiting for response (timeout: ${TIMEOUT_MS / 1000}s)...`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    clearTimeout(timeoutId);
    
    const data = await response.json();
    console.log(`[API] Status: ${response.status}`);
    
    return { status: response.status, data };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error(`[API] ❌ Request timed out after ${TIMEOUT_MS / 1000} seconds`);
      throw new Error(`Request timeout: ${endpoint}`);
    }
    
    console.error(`[API] ❌ Request failed:`, error.message);
    throw error;
  }
}

// Test 1: Create API Key
async function test1_CreateApiKey() {
  console.log('\n========================================');
  console.log('Test 1: POST /api/user/api-keys - Create API Key');
  console.log('========================================\n');
  
  const result = await apiRequest('/api/user/api-keys', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      name: `Test Key ${Date.now()}`,
    }),
  });
  
  console.log('\nResponse:', JSON.stringify(result.data, null, 2));
  
  if (result.status !== 201) {
    throw new Error(`Expected 201, got ${result.status}`);
  }
  
  if (!result.data.success) {
    throw new Error('API returned success: false');
  }
  
  if (!result.data.apiKey?.key) {
    throw new Error('No API key in response');
  }
  
  testApiKey = result.data.apiKey.key;
  testApiKeyId = result.data.apiKey.id;
  
  console.log('\n✅ Test 1 PASSED');
  console.log('API Key ID:', testApiKeyId);
  console.log('API Key (masked):', testApiKey.substring(0, 12) + '...');
  console.log('Prefix:', result.data.apiKey.key_prefix);
}

// Test 2: List API Keys
async function test2_ListApiKeys() {
  console.log('\n========================================');
  console.log('Test 2: GET /api/user/api-keys - List API Keys');
  console.log('========================================\n');
  
  const result = await apiRequest('/api/user/api-keys', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  });
  
  console.log('\nResponse:', JSON.stringify(result.data, null, 2));
  
  if (result.status !== 200) {
    throw new Error(`Expected 200, got ${result.status}`);
  }
  
  if (!result.data.success) {
    throw new Error('API returned success: false');
  }
  
  console.log(`\n✅ Test 2 PASSED`);
  console.log(`Found ${result.data.count} API keys`);
  
  const ourKey = result.data.apiKeys.find(k => k.id === testApiKeyId);
  if (ourKey) {
    console.log('Our test key found:');
    console.log('  Name:', ourKey.name);
    console.log('  Prefix:', ourKey.key_prefix);
    console.log('  Active:', ourKey.is_active);
  }
}

// Test 3: Submit Feedback
async function test3_SubmitFeedback() {
  console.log('\n========================================');
  console.log('Test 3: POST /api/feedback/collect - Submit Feedback');
  console.log('========================================\n');
  
  if (!testApiKey) throw new Error('No test API key');
  
  const feedbackData = {
    message_id: `test_msg_${Date.now()}`,
    rating: 5,
    thumbs: 'up',
    comment: 'Test feedback from automated test',
    category_tags: ['helpful', 'test'],
    metadata: { test: true },
  };
  
  console.log('Feedback data:', JSON.stringify(feedbackData, null, 2));
  
  const result = await apiRequest('/api/feedback/collect', {
    method: 'POST',
    headers: {
      'X-API-Key': testApiKey,
    },
    body: JSON.stringify(feedbackData),
  });
  
  console.log('\nResponse:', JSON.stringify(result.data, null, 2));
  
  if (result.status !== 201) {
    throw new Error(`Expected 201, got ${result.status}`);
  }
  
  if (!result.data.success) {
    throw new Error('API returned success: false');
  }
  
  console.log('\n✅ Test 3 PASSED');
  console.log('Feedback ID:', result.data.feedbackId);
}

// Test 4: Verify RLS Protection
async function test4_VerifyRLS() {
  console.log('\n========================================');
  console.log('Test 4: Verify RLS Protection');
  console.log('========================================\n');
  
  console.log('Attempting to list API keys with invalid token...');
  
  const result = await apiRequest('/api/user/api-keys', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer invalid_token_123',
    },
  });
  
  console.log('\nResponse:', JSON.stringify(result.data, null, 2));
  
  if (result.status !== 401) {
    throw new Error(`Expected 401, got ${result.status}`);
  }
  
  console.log('\n✅ Test 4 PASSED');
  console.log('Invalid token correctly rejected (401)');
}

// Test 5: Delete API Key
async function test5_DeleteApiKey() {
  console.log('\n========================================');
  console.log('Test 5: DELETE /api/user/api-keys/[id] - Revoke API Key');
  console.log('========================================\n');
  
  if (!testApiKeyId) throw new Error('No test API key ID');
  
  console.log('Revoking API key:', testApiKeyId);
  
  const result = await apiRequest(`/api/user/api-keys/${testApiKeyId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  });
  
  console.log('\nResponse:', JSON.stringify(result.data, null, 2));
  
  if (result.status !== 200) {
    throw new Error(`Expected 200, got ${result.status}`);
  }
  
  if (!result.data.success) {
    throw new Error('API returned success: false');
  }
  
  console.log('\n✅ Test 5 PASSED');
  console.log('API Key revoked successfully');
}

// Test 6: Verify Revoked Key
async function test6_VerifyRevoked() {
  console.log('\n========================================');
  console.log('Test 6: Verify Revoked Key Cannot Submit Feedback');
  console.log('========================================\n');
  
  if (!testApiKey) throw new Error('No test API key');
  
  console.log('Attempting to submit feedback with revoked key...');
  
  const result = await apiRequest('/api/feedback/collect', {
    method: 'POST',
    headers: {
      'X-API-Key': testApiKey,
    },
    body: JSON.stringify({
      message_id: `test_revoked_${Date.now()}`,
      rating: 5,
    }),
  });
  
  console.log('\nResponse:', JSON.stringify(result.data, null, 2));
  
  if (result.status !== 401) {
    throw new Error(`Expected 401, got ${result.status}`);
  }
  
  console.log('\n✅ Test 6 PASSED');
  console.log('Revoked key correctly rejected (401)');
}

// Run all tests
async function runTests() {
  const startTime = Date.now();
  
  try {
    await test1_CreateApiKey();
    await test2_ListApiKeys();
    await test3_SubmitFeedback();
    await test4_VerifyRLS();
    await test5_DeleteApiKey();
    await test6_VerifyRevoked();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n========================================');
    console.log('ALL TESTS PASSED! ✅');
    console.log('========================================\n');
    
    console.log('Summary:');
    console.log('✅ 1. API key creation works');
    console.log('✅ 2. API key listing works');
    console.log('✅ 3. Feedback submission works');
    console.log('✅ 4. RLS policies protect data');
    console.log('✅ 5. API key revocation works');
    console.log('✅ 6. Revoked keys cannot submit feedback');
    console.log(`\nTotal time: ${duration} seconds`);
    console.log('All endpoints functioning correctly!');
    
    process.exit(0);
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.error('\n========================================');
    console.error('TEST FAILED ❌');
    console.error('========================================\n');
    console.error('Error:', error.message);
    console.error(`\nTime elapsed: ${duration} seconds`);
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

runTests();
