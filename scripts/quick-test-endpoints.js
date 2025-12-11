#!/usr/bin/env node
/**
 * Quick test script for feedback collection endpoint
 * Uses direct database manipulation to create test API key
 * Date: 2025-10-17
 */

const fs = require('fs');
const path = require('path');

// Load env
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
console.log('Quick API Endpoint Test');
console.log('========================================\n');

// Import the key generator
const { generateApiKey } = require('../lib/auth/api-key-generator');

async function runQuickTest() {
  try {
    // Step 1: Generate an API key
    console.log('Step 1: Generating API key...');
    const { key, keyHash, keyPrefix } = generateApiKey();
    console.log('  Key Prefix:', keyPrefix);
    console.log('  Full Key:', key.substring(0, 20) + '...\n');
    
    // Step 2: Insert directly into database using service role
    console.log('Step 2: Inserting API key into database...');
    
    // Create a test user ID (you can replace with real user ID from your database)
    const testUserId = '00000000-0000-0000-0000-000000000000'; // Placeholder
    
    const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_api_keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        user_id: testUserId,
        name: 'Quick Test Key',
        key_hash: keyHash,
        key_prefix: keyPrefix,
        is_active: true,
      }),
    });
    
    if (!insertResponse.ok) {
      const error = await insertResponse.text();
      console.error('  Failed to insert API key:', error);
      console.log('\nNote: You need a valid user_id. Let me query for an existing user...\n');
      
      // Query for a real user
      const usersResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_current_user_id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      });
      
      console.log('Available auth.users - checking manually...');
      console.log('Please use Supabase Dashboard to create a user first, then run:');
      console.log('  curl -X POST http://localhost:3000/api/user/api-keys \\');
      console.log('    -H "Authorization: Bearer YOUR_USER_TOKEN" \\');
      console.log('    -H "Content-Type: application/json" \\');
      console.log('    -d \'{"name": "Test Key"}\'');
      return;
    }
    
    const insertedKey = await insertResponse.json();
    console.log('  API key inserted successfully!');
    console.log('  Key ID:', insertedKey[0]?.id, '\n');
    
    // Step 3: Test feedback collection
    console.log('Step 3: Testing feedback collection...');
    
    const feedbackResponse = await fetch(`${API_BASE}/feedback/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key,
      },
      body: JSON.stringify({
        message_id: 'test-msg-' + Date.now(),
        rating: 5,
        thumbs: 'up',
        comment: 'This is a test!',
        category_tags: ['test'],
      }),
    });
    
    const feedbackData = await feedbackResponse.json();
    console.log('  Status:', feedbackResponse.status);
    console.log('  Response:', JSON.stringify(feedbackData, null, 2));
    
    if (feedbackResponse.status === 201) {
      console.log('\n✅ Test PASSED - Feedback submitted successfully!');
    } else {
      console.log('\n❌ Test FAILED');
    }
    
  } catch (error) {
    console.error('\nError:', error.message);
  }
}

runQuickTest();
