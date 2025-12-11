// Deep Connection Debugging - Compare Python vs JavaScript Supabase behavior
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function debugConnection() {
  console.log('=== SUPABASE CONNECTION DEBUG ===');
  console.log('Time:', new Date().toISOString());
  console.log();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('Environment Check:');
  console.log('- SUPABASE_URL:', supabaseUrl);
  console.log('- ANON_KEY length:', anonKey?.length || 0);
  console.log('- SERVICE_KEY length:', serviceKey?.length || 0);
  console.log();

  // Test different client configurations
  console.log('--- 1. Test Basic Connection ---');
  
  // Default JS client (like our test)
  const client1 = createClient(supabaseUrl, anonKey);
  
  // JS client with explicit options (closer to Python behavior)  
  const client2 = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  // Service role client for comparison
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const testJobId = '3c3513cd-6f45-4733-8ae2-b09e229460a2';

  console.log('Testing with job ID:', testJobId);
  console.log();

  // Test 1: Basic anon client (our working test)
  try {
    console.log('Client 1 (default JS): Testing connection...');
    const { data, error } = await client1
      .from('local_training_metrics')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ Client 1 connection failed:', error);
    } else {
      console.log('✅ Client 1 connected, metrics count:', data);
    }
  } catch (err) {
    console.log('❌ Client 1 exception:', err.message);
  }

  // Test 2: Anon client without session (like Python)
  try {
    console.log('Client 2 (no session): Testing connection...');
    const { data, error } = await client2
      .from('local_training_metrics')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ Client 2 connection failed:', error);
    } else {
      console.log('✅ Client 2 connected, metrics count:', data);
    }
  } catch (err) {
    console.log('❌ Client 2 exception:', err.message);
  }

  console.log();
  console.log('--- 2. Test Metrics Insertion with Different Clients ---');

  const testMetric = {
    job_id: testJobId,
    step: 9999,
    epoch: 0,
    train_loss: 0.999,
    learning_rate: 0.00005,
    timestamp: new Date().toISOString()
  };

  // Test insertion with both clients
  for (let i = 1; i <= 2; i++) {
    const client = i === 1 ? client1 : client2;
    const clientName = i === 1 ? 'Client 1 (default)' : 'Client 2 (no session)';
    
    try {
      console.log(`${clientName}: Attempting metrics insert...`);
      const { error } = await client
        .from('local_training_metrics')
        .insert(testMetric);
      
      if (error) {
        console.log(`❌ ${clientName} INSERT FAILED:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
      } else {
        console.log(`✅ ${clientName} INSERT SUCCEEDED`);
        
        // Cleanup
        await serviceClient
          .from('local_training_metrics')
          .delete()
          .eq('job_id', testJobId)
          .eq('step', 9999);
      }
    } catch (err) {
      console.log(`❌ ${clientName} exception:`, err.message);
    }
  }

  console.log();
  console.log('--- 3. Check Connection Headers and Auth ---');

  // Check what headers are being sent
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Direct REST API test:');
    console.log('- Status:', response.status);
    console.log('- Headers received:', Object.fromEntries(response.headers.entries()));
  } catch (err) {
    console.log('❌ Direct REST API failed:', err.message);
  }

  console.log();
  console.log('--- 4. Simulate Python Client Behavior ---');
  
  // Try to mimic what Python supabase client might be doing
  try {
    const pythonLikeInsert = await fetch(`${supabaseUrl}/rest/v1/local_training_metrics`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(testMetric)
    });

    console.log('Python-like direct POST:');
    console.log('- Status:', pythonLikeInsert.status);
    console.log('- Status Text:', pythonLikeInsert.statusText);
    
    if (!pythonLikeInsert.ok) {
      const errorText = await pythonLikeInsert.text();
      console.log('- Error Body:', errorText);
    } else {
      console.log('✅ Python-like POST succeeded');
      
      // Cleanup
      await serviceClient
        .from('local_training_metrics')
        .delete()
        .eq('job_id', testJobId)
        .eq('step', 9999);
    }
  } catch (err) {
    console.log('❌ Python-like POST failed:', err.message);
  }

  console.log('\n=== CONNECTION DEBUG COMPLETE ===');
}

debugConnection();