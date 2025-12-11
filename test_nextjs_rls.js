const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testNextJSContext() {
  console.log('🔍 TESTING NEXT.JS CONTEXT FOR RLS ERRORS');
  console.log('='.repeat(60));

  // Create clients exactly as Next.js would
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('Environment check:');
  console.log('- Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.log('- Anon Key:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
  console.log('- Service Key:', supabaseServiceKey ? '✅ Set' : '❌ Missing');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('❌ Missing required environment variables');
    return;
  }

  // Test the exact scenario that would happen in RunPod
  console.log('\n🧪 SIMULATING RUNPOD TRAINING SCENARIO');
  
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  
  // Create a test job first (this should work)
  const testJobId = `test-nextjs-${Date.now()}`;
  
  try {
    console.log('\n1. Creating test job...');
    const { data: jobData, error: jobError } = await anonClient
      .from('local_training_jobs')
      .insert({
        id: testJobId,
        model_name: 'test-nextjs-model',
        status: 'running',
        config: { test: true },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      console.log('❌ Job creation failed:', jobError);
      return;
    }
    
    console.log('✅ Job created:', jobData.id);

    console.log('\n2. Attempting metrics insertion (where RLS fails)...');
    
    // This is the exact operation that fails in RunPod
    const metricsData = {
      job_id: testJobId,
      step: 1,
      loss: 0.856,
      learning_rate: 0.0001,
      timestamp: new Date().toISOString()
    };

    console.log('Inserting metrics:', JSON.stringify(metricsData, null, 2));

    const { data: insertData, error: insertError } = await anonClient
      .from('local_training_metrics')
      .insert(metricsData)
      .select()
      .single();

    if (insertError) {
      console.log('❌ METRICS INSERT FAILED:');
      console.log('   Code:', insertError.code);
      console.log('   Message:', insertError.message);
      console.log('   Details:', insertError.details);
      console.log('   Hint:', insertError.hint);
      
      if (insertError.code === '42501') {
        console.log('\n🚨 RLS VIOLATION CONFIRMED');
        console.log('This is the same error you\'re seeing');
        
        // Check if it's a policy issue or performance issue
        if (insertError.message.includes('timeout') || insertError.message.includes('statement')) {
          console.log('💡 This appears to be a TIMEOUT disguised as RLS violation');
        } else {
          console.log('💡 This appears to be a genuine POLICY violation');
        }
      }
      
      // Try with different approaches
      console.log('\n3. Trying alternative approaches...');
      
      // Try with explicit auth
      console.log('3a. Trying with explicit auth context...');
      await anonClient.auth.setSession({
        access_token: supabaseAnonKey,
        refresh_token: '',
        expires_in: 3600,
        token_type: 'bearer',
        user: null
      });
      
      const { data: authData, error: authError } = await anonClient
        .from('local_training_metrics')
        .insert(metricsData)
        .select()
        .single();
        
      if (authError) {
        console.log('❌ Auth approach failed:', authError.code, authError.message);
      } else {
        console.log('✅ Auth approach worked:', authData.id);
      }

      // Try with service role
      console.log('3b. Trying with service role (bypasses RLS)...');
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      
      const { data: serviceData, error: serviceError } = await serviceClient
        .from('local_training_metrics')
        .insert(metricsData)
        .select()
        .single();
        
      if (serviceError) {
        console.log('❌ Service role failed:', serviceError.code, serviceError.message);
        console.log('🚨 This suggests a fundamental database issue');
      } else {
        console.log('✅ Service role worked:', serviceData.id);
        console.log('💡 This confirms RLS is the issue, not database connectivity');
      }

    } else {
      console.log('✅ Metrics insert successful:', insertData.id);
      console.log('💡 The RLS issue may be intermittent or already fixed');
    }

    // Cleanup
    console.log('\n4. Cleaning up test data...');
    await anonClient.from('local_training_metrics').delete().eq('job_id', testJobId);
    await anonClient.from('local_training_jobs').delete().eq('id', testJobId);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
    console.log('Stack:', error.stack);
  }

  // Additional Next.js specific checks
  console.log('\n5. NEXT.JS ENVIRONMENT ANALYSIS');
  console.log('Node version:', process.version);
  console.log('Platform:', process.platform);
  console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
  console.log('Next.js port detection:', process.env.PORT || 'not set');
  
  // Check for potential connection pooling issues
  console.log('\n6. CONNECTION DIAGNOSTICS');
  console.log('Testing multiple rapid connections...');
  
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      anonClient
        .from('local_training_jobs')
        .select('count', { count: 'exact', head: true })
        .then(result => ({ index: i, success: !result.error, error: result.error?.code }))
        .catch(error => ({ index: i, success: false, error: error.message }))
    );
  }
  
  const results = await Promise.all(promises);
  results.forEach(result => {
    console.log(`Connection ${result.index}: ${result.success ? '✅' : '❌'} ${result.error || ''}`);
  });
}

testNextJSContext().catch(console.error);