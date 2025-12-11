// Test script to diagnose the batch testing model dropdown issue
// Run this with: node test_batch_models_issue.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('=== DIAGNOSING BATCH TESTING MODEL DROPDOWN ISSUE ===\n');

async function diagnose() {
  // Test 1: Direct database query (bypass RLS)
  console.log('TEST 1: Direct database query (service role - bypasses RLS)');
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: allModels, error: adminError } = await adminClient
    .from('llm_models')
    .select('id, name, provider, is_global, user_id, enabled')
    .eq('enabled', true)
    .order('created_at', { ascending: false });
  
  let userIds = [];
  if (adminError) {
    console.error('  ❌ Error:', adminError.message);
  } else {
    console.log(`  ✓ Found ${allModels.length} enabled models total`);
    console.log(`    - Global: ${allModels.filter(m => m.is_global).length}`);
    console.log(`    - User-specific: ${allModels.filter(m => !m.is_global).length}`);
    
    // Check if all user models belong to same user
    userIds = [...new Set(allModels.filter(m => !m.is_global).map(m => m.user_id))];
    console.log(`    - Unique user IDs: ${userIds.length}`);
    if (userIds.length > 0) {
      console.log(`    - User ID: ${userIds[0]}`);
    }
  }
  
  // Test 2: Anon client query (what API does without auth)
  console.log('\nTEST 2: Anon client query (simulates unauthenticated API call)');
  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: globalModels, error: anonError } = await anonClient
    .from('llm_models')
    .select('id, name, provider, is_global, user_id, enabled')
    .eq('enabled', true)
    .eq('is_global', true)
    .order('created_at', { ascending: false });
  
  if (anonError) {
    console.error('  ❌ Error:', anonError.message);
  } else {
    console.log(`  ✓ Found ${globalModels.length} global models`);
    globalModels.forEach((m, i) => {
      console.log(`    ${i + 1}. ${m.name} (${m.provider})`);
    });
  }
  
  // Test 3: Check RLS policies
  console.log('\nTEST 3: Checking RLS policies on llm_models table');
  const { data: policies, error: policyError } = await adminClient
    .from('pg_policies')
    .select('*')
    .eq('tablename', 'llm_models');
  
  if (policyError) {
    console.log('  ⚠️  Could not query policies:', policyError.message);
  } else if (policies && policies.length > 0) {
    console.log(`  ✓ Found ${policies.length} RLS policies:`);
    policies.forEach(p => {
      console.log(`    - ${p.policyname} (${p.cmd})`);
      console.log(`      USING: ${p.qual || 'none'}`);
    });
  } else {
    console.log('  ⚠️  No RLS policies found (or table is in different schema)');
  }
  
  // Test 4: Try the exact query the API uses
  console.log('\nTEST 4: Simulating API query logic');
  const testUserId = userIds.length > 0 ? userIds[0] : null;
  
  if (testUserId) {
    console.log(`  Testing with user ID: ${testUserId}`);
    
    // Query 1: Using OR clause like the API
    const { data: apiStyleModels, error: apiError } = await anonClient
      .from('llm_models')
      .select('id, name, provider, is_global, user_id')
      .eq('enabled', true)
      .or(`is_global.eq.true,user_id.eq.${testUserId}`)
      .order('created_at', { ascending: false });
    
    if (apiError) {
      console.error('  ❌ API-style query error:', apiError.message);
    } else {
      console.log(`  ✓ API-style query returned ${apiStyleModels.length} models`);
      console.log(`    - Global: ${apiStyleModels.filter(m => m.is_global).length}`);
      console.log(`    - User-specific: ${apiStyleModels.filter(m => !m.is_global).length}`);
      
      if (apiStyleModels.length !== allModels.length) {
        console.log(`  ⚠️  MISMATCH: Expected ${allModels.length} but got ${apiStyleModels.length}`);
        console.log('  This suggests RLS is blocking user-specific models!');
      }
    }
  } else {
    console.log('  ⏭️  No user-specific models to test with');
  }
  
  // Test 5: Check if authenticated queries work
  console.log('\nTEST 5: Testing authenticated query pattern');
  console.log('  ℹ️  This requires an active user session in the browser');
  console.log('  The issue is likely:');
  console.log('    1. Session token is undefined/null when BatchTesting loads');
  console.log('    2. RLS policies block access to user models via anon key');
  console.log('    3. Token validation fails silently in API');
  
  console.log('\n=== DIAGNOSIS COMPLETE ===\n');
  
  console.log('LIKELY ROOT CAUSE:');
  console.log('When using the anon key (unauthenticated), RLS policies on llm_models');
  console.log('only allow reading global models. User-specific models require authentication.');
  console.log('');
  console.log('SOLUTION:');
  console.log('1. Verify sessionToken is actually passed to BatchTesting component');
  console.log('2. Check browser console for "[BatchTesting] useEffect triggered, sessionToken:" log');
  console.log('3. If sessionToken is "missing", the parent component is not passing it correctly');
  console.log('4. If sessionToken is "present" but still only 4 models show, check API logs');
}

diagnose().catch(console.error);
