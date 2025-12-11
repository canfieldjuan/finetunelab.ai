// Investigate the 500 Internal Server Errors
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function investigate500Errors() {
  console.log('=== 500 ERROR INVESTIGATION ===');
  console.log('Time:', new Date().toISOString());
  console.log();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const anonClient = createClient(supabaseUrl, anonKey);

  console.log('--- Detailed 500 Error Analysis ---');
  
  try {
    const { data, error, status, statusText } = await anonClient
      .from('local_training_metrics')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log('500 Error Details:');
      console.log('- Status:', status);
      console.log('- Status Text:', statusText);
      console.log('- Error Object:', JSON.stringify(error, null, 2));
      console.log('- Error Code:', error.code);
      console.log('- Error Message:', error.message);
      console.log('- Error Details:', error.details);
      console.log('- Error Hint:', error.hint);
    } else {
      console.log('✅ No error this time, data:', data);
    }

    // Try a direct HTTP request to see raw response
    console.log('\n--- Raw HTTP Request Analysis ---');
    
    const response = await fetch(`${supabaseUrl}/rest/v1/local_training_metrics?select=count&head=true`, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Raw HTTP Response:');
    console.log('- Status:', response.status);
    console.log('- Status Text:', response.statusText);
    console.log('- Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorBody = await response.text();
      console.log('- Error Body:', errorBody);
    }

    // Now let's test if this is related to the specific query
    console.log('\n--- Test Different Query Types ---');
    
    const tests = [
      { name: 'Simple SELECT', query: () => anonClient.from('local_training_metrics').select('id').limit(1) },
      { name: 'COUNT query', query: () => anonClient.from('local_training_metrics').select('count', { count: 'exact' }) },
      { name: 'HEAD query', query: () => anonClient.from('local_training_metrics').select('count', { count: 'exact', head: true }) },
      { name: 'Different table', query: () => anonClient.from('local_training_jobs').select('id').limit(1) },
    ];

    for (const test of tests) {
      try {
        console.log(`Testing ${test.name}...`);
        const result = await test.query();
        
        if (result.error) {
          console.log(`❌ ${test.name} failed:`, result.error.message, `(${result.status})`);
        } else {
          console.log(`✅ ${test.name} succeeded`);
        }
      } catch (err) {
        console.log(`❌ ${test.name} exception:`, err.message);
      }
    }

    // Check if it's related to the anon key or permissions
    console.log('\n--- Check Permission-Related Issues ---');
    
    try {
      // Try to access a table that anon definitely shouldn't have access to
      const { error: authTestError } = await anonClient
        .from('auth.users')
        .select('id')
        .limit(1);
      
      if (authTestError) {
        console.log('Expected auth error (anon accessing auth.users):', authTestError.message);
      } else {
        console.log('⚠️ Unexpected: anon can access auth.users');
      }
    } catch (err) {
      console.log('Auth test exception (expected):', err.message);
    }

    // Test if the issue is load-related
    console.log('\n--- Load Testing ---');
    
    console.log('Single request test...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    
    const { error: singleError } = await anonClient
      .from('local_training_metrics')
      .select('id')
      .limit(1);
    
    if (singleError) {
      console.log('❌ Even single request fails:', singleError.message);
    } else {
      console.log('✅ Single request succeeds after delay');
    }

  } catch (error) {
    console.error('Investigation failed:', error);
  }

  console.log('\n=== 500 ERROR INVESTIGATION COMPLETE ===');
}

investigate500Errors();