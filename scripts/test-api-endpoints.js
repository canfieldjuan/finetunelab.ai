#!/usr/bin/env node
/**
 * Test script for API endpoints with real Supabase database
 * Tests authentication, RLS policies, and endpoint functionality
 * Date: 2025-10-17
 */

// Load environment variables from .env file
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = 'http://localhost:3000/api';

console.log('========================================');
console.log('API Endpoint Integration Tests');
console.log('========================================\n');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials!');
  process.exit(1);
}

// Test 1: Create a test user and get auth token
async function getTestUserToken() {
  console.log('\n--- Test 1: Get Test User Token ---');
  
  // Create or sign in test user
  const email = 'test-widget@example.com';
  const password = 'test-widget-password-123';
  
  const signUpResponse = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });
  
  const signUpData = await signUpResponse.json();
  
  if (signUpData.access_token) {
    console.log('Test user created/signed in successfully');
    console.log('User ID:', signUpData.user?.id);
    return {
      token: signUpData.access_token,
      userId: signUpData.user?.id,
    };
  }
  
  // Try signing in if already exists
  const signInResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });
  
  const signInData = await signInResponse.json();
  
  if (signInData.access_token) {
    console.log('Test user signed in successfully');
    console.log('User ID:', signInData.user?.id);
    return {
      token: signInData.access_token,
      userId: signInData.user?.id,
    };
  }
  
  console.error('Failed to get test user token:', signInData);
  throw new Error('Failed to authenticate test user');
}

// Test 2: Create API key
async function testCreateApiKey(authToken) {
  console.log('\n--- Test 2: POST /api/user/api-keys (Create API Key) ---');
  
  const response = await fetch(`${API_BASE}/user/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      name: `Test Widget Key ${Date.now()}`,
    }),
  });
  
  const data = await response.json();
  
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (response.status === 201 && data.success && data.apiKey?.key) {
    console.log('Test 2 PASSED');
    return {
      keyId: data.apiKey.id,
      apiKey: data.apiKey.key,
      keyPrefix: data.apiKey.key_prefix,
    };
  } else {
    console.error('Test 2 FAILED');
    return null;
  }
}

// Test 3: List API keys
async function testListApiKeys(authToken) {
  console.log('\n--- Test 3: GET /api/user/api-keys (List API Keys) ---');
  
  const response = await fetch(`${API_BASE}/user/api-keys`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });
  
  const data = await response.json();
  
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (response.status === 200 && data.success && Array.isArray(data.apiKeys)) {
    console.log('Test 3 PASSED - Found', data.count, 'API keys');
    return true;
  } else {
    console.error('Test 3 FAILED');
    return false;
  }
}

// Test 4: Submit feedback with API key
async function testSubmitFeedback(apiKey) {
  console.log('\n--- Test 4: POST /api/feedback/collect (Submit Feedback) ---');
  
  const response = await fetch(`${API_BASE}/feedback/collect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      message_id: 'test-message-' + Date.now(),
      rating: 5,
      thumbs: 'up',
      comment: 'This is a test feedback from integration test',
      category_tags: ['test', 'integration'],
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    }),
  });
  
  const data = await response.json();
  
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (response.status === 201 && data.success && data.feedbackId) {
    console.log('Test 4 PASSED - Feedback ID:', data.feedbackId);
    return data.feedbackId;
  } else {
    console.error('Test 4 FAILED');
    return null;
  }
}

// Test 5: Test invalid API key
async function testInvalidApiKey() {
  console.log('\n--- Test 5: Test Invalid API Key ---');
  
  const response = await fetch(`${API_BASE}/feedback/collect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'wak_invalid_key_should_fail',
    },
    body: JSON.stringify({
      message_id: 'test-message',
      rating: 5,
    }),
  });
  
  const data = await response.json();
  
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (response.status === 401 && !data.success) {
    console.log('Test 5 PASSED - Invalid key rejected');
    return true;
  } else {
    console.error('Test 5 FAILED - Invalid key should be rejected');
    return false;
  }
}

// Test 6: Test validation (invalid rating)
async function testValidation(apiKey) {
  console.log('\n--- Test 6: Test Validation (Invalid Rating) ---');
  
  const response = await fetch(`${API_BASE}/feedback/collect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      message_id: 'test-message',
      rating: 10, // Invalid - should be 1-5
    }),
  });
  
  const data = await response.json();
  
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (response.status === 400 && !data.success) {
    console.log('Test 6 PASSED - Invalid rating rejected');
    return true;
  } else {
    console.error('Test 6 FAILED - Invalid rating should be rejected');
    return false;
  }
}

// Test 7: Delete API key
async function testDeleteApiKey(authToken, keyId) {
  console.log('\n--- Test 7: DELETE /api/user/api-keys/[id] (Revoke Key) ---');
  
  const response = await fetch(`${API_BASE}/user/api-keys/${keyId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });
  
  const data = await response.json();
  
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (response.status === 200 && data.success) {
    console.log('Test 7 PASSED - Key revoked');
    return true;
  } else {
    console.error('Test 7 FAILED');
    return false;
  }
}

// Test 8: Verify revoked key doesn't work
async function testRevokedKey(apiKey) {
  console.log('\n--- Test 8: Test Revoked Key ---');
  
  const response = await fetch(`${API_BASE}/feedback/collect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      message_id: 'test-message',
      rating: 5,
    }),
  });
  
  const data = await response.json();
  
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (response.status === 401 && !data.success) {
    console.log('Test 8 PASSED - Revoked key rejected');
    return true;
  } else {
    console.error('Test 8 FAILED - Revoked key should be rejected');
    return false;
  }
}

// Run all tests
async function runTests() {
  try {
    // Get auth token
    const { token, userId } = await getTestUserToken();
    
    // Test creating API key
    const apiKeyData = await testCreateApiKey(token);
    if (!apiKeyData) {
      console.error('\nFailed to create API key, stopping tests');
      return;
    }
    
    // Test listing API keys
    await testListApiKeys(token);
    
    // Test submitting feedback
    await testSubmitFeedback(apiKeyData.apiKey);
    
    // Test invalid API key
    await testInvalidApiKey();
    
    // Test validation
    await testValidation(apiKeyData.apiKey);
    
    // Test deleting API key
    await testDeleteApiKey(token, apiKeyData.keyId);
    
    // Test that revoked key doesn't work
    await testRevokedKey(apiKeyData.apiKey);
    
    console.log('\n========================================');
    console.log('All Tests Complete!');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n========================================');
    console.error('Test Failed with Error:');
    console.error(error);
    console.error('========================================\n');
  }
}

// Run tests
runTests();
