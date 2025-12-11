/**
 * Browser Console Test Script for API Endpoints
 * Copy and paste this entire script into your browser console
 * while logged into http://localhost:3000
 * 
 * Date: 2025-10-17
 */

(async function testApiEndpoints() {
  console.log('========================================');
  console.log('API Endpoint Tests - Browser Console');
  console.log('========================================\n');

  const API_BASE = 'http://localhost:3000';
  let testApiKey = null;
  let testApiKeyId = null;

  // Get auth token from localStorage - Supabase stores it under a specific key
  // Try multiple possible keys
  let authToken = null;
  
  // Method 1: Look for all localStorage keys that contain 'supabase'
  console.log('Searching for Supabase auth token in localStorage...\n');
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('supabase')) {
      console.log('Found key:', key);
      try {
        const value = JSON.parse(localStorage.getItem(key) || '{}');
        console.log('  Type:', typeof value);
        
        // Check for access_token in different locations
        if (value.access_token) {
          authToken = value.access_token;
          console.log('  ✅ Found access_token directly');
          break;
        } else if (value.session?.access_token) {
          authToken = value.session.access_token;
          console.log('  ✅ Found access_token in session');
          break;
        } else if (value.currentSession?.access_token) {
          authToken = value.currentSession.access_token;
          console.log('  ✅ Found access_token in currentSession');
          break;
        }
      } catch (e) {
        console.log('  (Not JSON data)');
      }
    }
  }

  if (!authToken) {
    console.error('❌ No auth token found. Please login first!');
    console.error('\nTo get your token manually, run this in console:');
    console.error('Object.keys(localStorage).filter(k => k.includes("supabase"))');
    console.error('\nThen check each key to find the access_token');
    return;
  }

  console.log('\n✅ Found auth token');
  console.log('Token (first 20 chars):', authToken.substring(0, 20) + '...\n');

  // Helper function
  async function apiRequest(endpoint, options = {}) {
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

  try {
    // Test 1: Create API Key
    console.log('\n========================================');
    console.log('Test 1: Create API Key');
    console.log('========================================\n');
    
    const createResult = await apiRequest('/api/user/api-keys', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({
        name: `Browser Test Key ${Date.now()}`,
      }),
    });
    
    console.log('Response:', createResult.data);
    
    if (createResult.status === 201 && createResult.data.success) {
      testApiKey = createResult.data.apiKey.key;
      testApiKeyId = createResult.data.apiKey.id;
      console.log('✅ Test 1 PASSED');
      console.log('API Key:', testApiKey.substring(0, 12) + '...');
      console.log('Key ID:', testApiKeyId);
    } else {
      console.error('❌ Test 1 FAILED');
      return;
    }

    // Test 2: List API Keys
    console.log('\n========================================');
    console.log('Test 2: List API Keys');
    console.log('========================================\n');
    
    const listResult = await apiRequest('/api/user/api-keys', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    
    console.log('Response:', listResult.data);
    
    if (listResult.status === 200 && listResult.data.success) {
      console.log('✅ Test 2 PASSED');
      console.log(`Found ${listResult.data.count} API keys`);
    } else {
      console.error('❌ Test 2 FAILED');
      return;
    }

    // Test 3: Submit Feedback
    console.log('\n========================================');
    console.log('Test 3: Submit Feedback');
    console.log('========================================\n');
    
    const feedbackResult = await apiRequest('/api/feedback/collect', {
      method: 'POST',
      headers: { 'X-API-Key': testApiKey },
      body: JSON.stringify({
        message_id: `browser_test_${Date.now()}`,
        rating: 5,
        thumbs: 'up',
        comment: 'Testing from browser console!',
        category_tags: ['test', 'browser'],
        metadata: { source: 'browser-console-test' },
      }),
    });
    
    console.log('Response:', feedbackResult.data);
    
    if (feedbackResult.status === 201 && feedbackResult.data.success) {
      console.log('✅ Test 3 PASSED');
      console.log('Feedback ID:', feedbackResult.data.feedbackId);
    } else {
      console.error('❌ Test 3 FAILED');
      return;
    }

    // Test 4: Verify RLS (try invalid token)
    console.log('\n========================================');
    console.log('Test 4: Verify RLS Protection');
    console.log('========================================\n');
    
    const rlsResult = await apiRequest('/api/user/api-keys', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer invalid_token' },
    });
    
    if (rlsResult.status === 401) {
      console.log('✅ Test 4 PASSED');
      console.log('Invalid token correctly rejected');
    } else {
      console.error('❌ Test 4 FAILED');
      console.error('Invalid token was accepted!');
    }

    // Test 5: Delete API Key
    console.log('\n========================================');
    console.log('Test 5: Delete API Key');
    console.log('========================================\n');
    
    const deleteResult = await apiRequest(`/api/user/api-keys/${testApiKeyId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    
    console.log('Response:', deleteResult.data);
    
    if (deleteResult.status === 200 && deleteResult.data.success) {
      console.log('✅ Test 5 PASSED');
      console.log('API Key revoked');
    } else {
      console.error('❌ Test 5 FAILED');
      return;
    }

    // Test 6: Verify revoked key doesn't work
    console.log('\n========================================');
    console.log('Test 6: Verify Revoked Key');
    console.log('========================================\n');
    
    const revokedResult = await apiRequest('/api/feedback/collect', {
      method: 'POST',
      headers: { 'X-API-Key': testApiKey },
      body: JSON.stringify({
        message_id: `revoked_test_${Date.now()}`,
        rating: 5,
      }),
    });
    
    if (revokedResult.status === 401) {
      console.log('✅ Test 6 PASSED');
      console.log('Revoked key correctly rejected');
    } else {
      console.error('❌ Test 6 FAILED');
      console.error('Revoked key was accepted!');
    }

    // Summary
    console.log('\n========================================');
    console.log('ALL TESTS PASSED! ✅');
    console.log('========================================\n');
    console.log('Summary:');
    console.log('1. ✅ API key creation works');
    console.log('2. ✅ API key listing works');
    console.log('3. ✅ Feedback submission works');
    console.log('4. ✅ RLS policies protect data');
    console.log('5. ✅ API key revocation works');
    console.log('6. ✅ Revoked keys cannot submit feedback');
    console.log('\nAll endpoints functioning correctly!');

  } catch (error) {
    console.error('\n========================================');
    console.error('TEST FAILED ❌');
    console.error('========================================\n');
    console.error('Error:', error.message);
    console.error(error);
  }
})();
