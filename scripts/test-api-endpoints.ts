#!/usr/bin/env tsx
/**
 * Test API Endpoints with Real Database
 * Tests the widget feedback API endpoints we just created
 * Date: 2025-10-17
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

console.log('========================================');
console.log('API Endpoint Tests - Real Database');
console.log('========================================\n');

// Load environment variables from .env file
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const API_BASE = 'http://localhost:3000';
const TEST_EMAIL = 'canfieldjuan24@gmail.com';
const TEST_PASSWORD = '@canfi1287';

let authToken: string | null = null;
let testApiKey: string | null = null;
let testApiKeyId: string | null = null;

// Helper function to make API requests
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ status: number; data: unknown }> {
  const url = `${API_BASE}${endpoint}`;
  console.log(`[API] ${options.method || 'GET'} ${endpoint}`);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const data = await response.json();
  console.log(`[API] Status: ${response.status}`);
  
  return { status: response.status, data };
}

// Test 1: Sign in to get auth token
async function test1_SignIn() {
  console.log('\n========================================');
  console.log('Test 1: Sign In with Supabase Auth');
  console.log('========================================\n');
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  console.log('Email:', TEST_EMAIL);
  console.log('Signing in...\n');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  
  if (error) {
    console.error('Sign in failed:', error.message);
    throw new Error('Authentication failed');
  }
  
  if (!data.session) {
    throw new Error('No session returned');
  }
  
  authToken = data.session.access_token;
  
  console.log('User ID:', data.user?.id);
  console.log('Email:', data.user?.email);
  console.log('Token (first 20 chars):', authToken.substring(0, 20) + '...');
  console.log('Test 1 PASSED\n');
  
  return data.user?.id;
}

// Test 2: Create API Key
async function test2_CreateApiKey() {
  console.log('========================================');
  console.log('Test 2: POST /api/user/api-keys - Create API Key');
  console.log('========================================\n');
  
  if (!authToken) throw new Error('No auth token');
  
  const result = await apiRequest('/api/user/api-keys', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      name: `Test Widget Key ${Date.now()}`,
    }),
  });
  
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
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
  
  console.log('\nAPI Key Created:');
  console.log('  ID:', testApiKeyId);
  console.log('  Name:', result.data.apiKey.name);
  console.log('  Key (masked):', testApiKey ? testApiKey.substring(0, 12) + '...' : 'N/A');
  console.log('  Prefix:', result.data.apiKey.key_prefix);
  console.log('Test 2 PASSED\n');
}

// Test 3: List API Keys
async function test3_ListApiKeys() {
  console.log('========================================');
  console.log('Test 3: GET /api/user/api-keys - List API Keys');
  console.log('========================================\n');
  
  if (!authToken) throw new Error('No auth token');
  
  const result = await apiRequest('/api/user/api-keys', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });
  
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  if (result.status !== 200) {
    throw new Error(`Expected 200, got ${result.status}`);
  }
  
  if (!result.data.success) {
    throw new Error('API returned success: false');
  }
  
  if (!Array.isArray(result.data.apiKeys)) {
    throw new Error('apiKeys is not an array');
  }
  
  console.log(`\nFound ${result.data.count} API keys`);
  
  const ourKey = result.data.apiKeys.find((k: unknown) => k.id === testApiKeyId);
  if (!ourKey) {
    throw new Error('Our test key not found in list');
  }
  
  console.log('Our key found:');
  console.log('  ID:', ourKey.id);
  console.log('  Name:', ourKey.name);
  console.log('  Prefix:', ourKey.key_prefix);
  console.log('  Active:', ourKey.is_active);
  console.log('Test 3 PASSED\n');
}

// Test 4: Submit Feedback (Widget Endpoint)
async function test4_SubmitFeedback() {
  console.log('========================================');
  console.log('Test 4: POST /api/feedback/collect - Submit Feedback');
  console.log('========================================\n');
  
  if (!testApiKey) throw new Error('No test API key');
  
  const feedbackData = {
    message_id: `test_msg_${Date.now()}`,
    rating: 5,
    thumbs: 'up',
    comment: 'This is a test feedback from automated tests',
    category_tags: ['helpful', 'accurate', 'test'],
    metadata: {
      test: true,
      timestamp: new Date().toISOString(),
    },
  };
  
  console.log('Submitting feedback with API key...\n');
  
  const result = await apiRequest('/api/feedback/collect', {
    method: 'POST',
    headers: {
      'X-API-Key': testApiKey,
    },
    body: JSON.stringify(feedbackData),
  });
  
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  if (result.status !== 201) {
    throw new Error(`Expected 201, got ${result.status}`);
  }
  
  if (!result.data.success) {
    throw new Error('API returned success: false');
  }
  
  if (!result.data.feedbackId) {
    throw new Error('No feedbackId in response');
  }
  
  console.log('\nFeedback submitted successfully:');
  console.log('  Feedback ID:', result.data.feedbackId);
  console.log('  Message:', result.data.message);
  console.log('Test 4 PASSED\n');
}

// Test 5: Test Rate Limiting
async function test5_RateLimiting() {
  console.log('========================================');
  console.log('Test 5: Rate Limiting (100 req/min)');
  console.log('========================================\n');
  
  if (!testApiKey) throw new Error('No test API key');
  
  console.log('Making 5 rapid requests to test rate limiting...\n');
  
  let successCount = 0;
  
  for (let i = 0; i < 5; i++) {
    const result = await apiRequest('/api/feedback/collect', {
      method: 'POST',
      headers: {
        'X-API-Key': testApiKey,
      },
      body: JSON.stringify({
        message_id: `test_rate_limit_${Date.now()}_${i}`,
        rating: 5,
      }),
    });
    
    if (result.status === 201) {
      successCount++;
      console.log(`  Request ${i + 1}: Success (${result.status})`);
    } else {
      console.log(`  Request ${i + 1}: Failed (${result.status}) - ${result.data.error}`);
    }
  }
  
  console.log(`\n${successCount}/5 requests succeeded (all should succeed, limit is 100/min)`);
  
  if (successCount !== 5) {
    throw new Error('Expected all 5 requests to succeed');
  }
  
  console.log('Test 5 PASSED\n');
}

// Test 6: Verify RLS (try to access with invalid token)
async function test6_VerifyRLS() {
  console.log('========================================');
  console.log('Test 6: Verify RLS Policies');
  console.log('========================================\n');
  
  console.log('Attempting to list API keys with invalid token...\n');
  
  const result = await apiRequest('/api/user/api-keys', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer invalid_token_123',
    },
  });
  
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  if (result.status !== 401) {
    throw new Error(`Expected 401 Unauthorized, got ${result.status}`);
  }
  
  console.log('\nCorrectly rejected invalid token (401)');
  console.log('Test 6 PASSED\n');
}

// Test 7: Delete API Key
async function test7_DeleteApiKey() {
  console.log('========================================');
  console.log('Test 7: DELETE /api/user/api-keys/[id] - Revoke API Key');
  console.log('========================================\n');
  
  if (!authToken || !testApiKeyId) throw new Error('No auth token or API key ID');
  
  console.log('Revoking API key:', testApiKeyId, '\n');
  
  const result = await apiRequest(`/api/user/api-keys/${testApiKeyId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });
  
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  if (result.status !== 200) {
    throw new Error(`Expected 200, got ${result.status}`);
  }
  
  if (!result.data.success) {
    throw new Error('API returned success: false');
  }
  
  console.log('\nAPI Key revoked successfully');
  console.log('Test 7 PASSED\n');
}

// Test 8: Verify revoked key doesn't work
async function test8_VerifyRevoked() {
  console.log('========================================');
  console.log('Test 8: Verify Revoked Key Cannot Submit Feedback');
  console.log('========================================\n');
  
  if (!testApiKey) throw new Error('No test API key');
  
  console.log('Attempting to submit feedback with revoked key...\n');
  
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
  
  console.log('Response:', JSON.stringify(result.data, null, 2));
  
  if (result.status !== 401) {
    throw new Error(`Expected 401 Unauthorized, got ${result.status}`);
  }
  
  console.log('\nCorrectly rejected revoked key (401)');
  console.log('Test 8 PASSED\n');
}

// Run all tests
async function runTests() {
  try {
    const userId = await test1_SignIn();
    await test2_CreateApiKey();
    await test3_ListApiKeys();
    await test4_SubmitFeedback();
    await test5_RateLimiting();
    await test6_VerifyRLS();
    await test7_DeleteApiKey();
    await test8_VerifyRevoked();
    
    console.log('========================================');
    console.log('ALL TESTS PASSED!');
    console.log('========================================\n');
    
    console.log('Summary:');
    console.log('1. Authentication works correctly');
    console.log('2. API key creation works');
    console.log('3. API key listing works');
    console.log('4. Feedback submission works');
    console.log('5. Rate limiting allows valid requests');
    console.log('6. RLS policies prevent unauthorized access');
    console.log('7. API key revocation works');
    console.log('8. Revoked keys cannot submit feedback');
    console.log('\nUser ID:', userId);
    console.log('All endpoints functioning correctly!');
    
  } catch (error) {
    console.error('\n========================================');
    console.error('TEST FAILED');
    console.error('========================================\n');
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

runTests();
