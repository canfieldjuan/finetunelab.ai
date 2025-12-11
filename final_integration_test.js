// Final integration test to ensure all components work together
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function finalIntegrationTest() {
  console.log('🎯 FINAL INTEGRATION TEST - COMPLETE RUNPOD FIX');
  console.log('='.repeat(70));

  const results = {
    environmentVariables: false,
    schemaCompatibility: false,
    rlsPolicies: false,
    concurrentOperations: false,
    fallbackMechanism: false
  };

  try {
    // 1. Environment Variables Test
    console.log('1. ENVIRONMENT VARIABLES TEST');
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
      'SUPABASE_SERVICE_ROLE_KEY'
    ];
    
    let allVarsPresent = true;
    for (const varName of requiredVars) {
      const value = process.env[varName];
      const status = value ? '✅' : '❌';
      console.log(`   ${status} ${varName}: ${value ? 'SET' : 'MISSING'}`);
      if (!value) allVarsPresent = false;
    }
    results.environmentVariables = allVarsPresent;

    if (!allVarsPresent) {
      console.log('❌ Missing required environment variables - stopping test');
      return results;
    }

    // 2. Schema Compatibility Test
    console.log('\n2. SCHEMA COMPATIBILITY TEST');
    
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    const testJobId = `integration-test-${Date.now()}`;
    
    // Create job
    const { data: jobData, error: jobError } = await anonClient
      .from('local_training_jobs')
      .insert({
        id: testJobId,
        model_name: 'integration-test-model',
        status: 'running',
        config: { integration_test: true },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      console.log('   ❌ Job creation failed:', jobError.code, jobError.message);
      return results;
    }
    console.log('   ✅ Job creation successful');

    // Test metrics with all required fields
    const metricsPayload = {
      job_id: testJobId,
      step: 1,
      epoch: 0,  // This should now work with our fix
      train_loss: 1.5,
      eval_loss: null,
      learning_rate: 0.0001,
      grad_norm: 0.5,
      samples_per_second: 1.0,
      gpu_memory_allocated_gb: 2.5,
      gpu_memory_reserved_gb: 8.0,
      timestamp: new Date().toISOString()
    };

    const { data: metricsData, error: metricsError } = await anonClient
      .from('local_training_metrics')
      .insert(metricsPayload)
      .select()
      .single();

    if (metricsError) {
      console.log('   ❌ Metrics insertion failed:', metricsError.code, metricsError.message);
      
      // Test with service role as fallback
      console.log('   🔄 Testing service role fallback...');
      const { data: serviceFallback, error: serviceError } = await serviceClient
        .from('local_training_metrics')
        .insert(metricsPayload)
        .select()
        .single();
        
      if (serviceError) {
        console.log('   ❌ Service role fallback also failed:', serviceError.code);
        results.fallbackMechanism = false;
      } else {
        console.log('   ✅ Service role fallback successful');
        results.fallbackMechanism = true;
      }
    } else {
      console.log('   ✅ Metrics insertion successful with anon client');
      results.schemaCompatibility = true;
      results.rlsPolicies = true;
    }

    // 3. Concurrent Operations Test
    console.log('\n3. CONCURRENT OPERATIONS TEST');
    const concurrentPromises = [];
    
    for (let i = 2; i <= 6; i++) {
      concurrentPromises.push(
        anonClient
          .from('local_training_metrics')
          .insert({
            job_id: testJobId,
            step: i,
            epoch: 0,
            train_loss: 2.0 - (i * 0.05),
            learning_rate: 0.0001,
            timestamp: new Date().toISOString()
          })
          .select()
          .single()
      );
    }

    const concurrentResults = await Promise.allSettled(concurrentPromises);
    const successCount = concurrentResults.filter(r => r.status === 'fulfilled').length;
    const totalCount = concurrentResults.length;
    
    console.log(`   📊 Concurrent results: ${successCount}/${totalCount} successful`);
    
    if (successCount === totalCount) {
      console.log('   ✅ All concurrent operations successful');
      results.concurrentOperations = true;
    } else {
      console.log('   ⚠️  Some concurrent operations failed');
      results.concurrentOperations = false;
    }

    // Cleanup
    console.log('\n4. CLEANUP');
    await anonClient.from('local_training_metrics').delete().eq('job_id', testJobId);
    await anonClient.from('local_training_jobs').delete().eq('id', testJobId);
    console.log('   ✅ Test data cleaned up');

  } catch (error) {
    console.log('❌ Integration test failed:', error.message);
  }

  // Final Report
  console.log('\n' + '='.repeat(70));
  console.log('🏁 FINAL INTEGRATION TEST RESULTS');
  console.log('='.repeat(70));
  
  const tests = [
    { name: 'Environment Variables', result: results.environmentVariables },
    { name: 'Schema Compatibility', result: results.schemaCompatibility },
    { name: 'RLS Policies', result: results.rlsPolicies },
    { name: 'Concurrent Operations', result: results.concurrentOperations },
    { name: 'Fallback Mechanism', result: results.fallbackMechanism }
  ];

  let allPassed = true;
  for (const test of tests) {
    const status = test.result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.name}`);
    if (!test.result) allPassed = false;
  }

  console.log('\n' + '='.repeat(70));
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED - RunPod integration is ready for production');
    console.log('🚀 The 42501 RLS errors should be completely resolved');
  } else {
    console.log('⚠️  Some tests failed - review results above');
  }
  console.log('='.repeat(70));

  return results;
}

finalIntegrationTest();