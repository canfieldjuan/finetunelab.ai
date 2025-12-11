// Test the optimized RLS fix - verify performance improvements
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testOptimizedFix() {
  console.log('=== TESTING OPTIMIZED RLS FIX ===');
  console.log('Time:', new Date().toISOString());
  console.log();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const anonClient = createClient(supabaseUrl, anonKey);
  const serviceClient = createClient(supabaseUrl, serviceKey);

  console.log('--- 1. Test COUNT Performance (Previous Issue) ---');
  
  try {
    console.log('Testing anon role COUNT (this was timing out before)...');
    const start = Date.now();
    
    const { data: anonCount, error: anonError } = await anonClient
      .from('local_training_metrics')
      .select('count', { count: 'exact' });
    
    const duration = Date.now() - start;
    
    if (anonError) {
      console.log(`❌ Anon COUNT still failing (${duration}ms):`, anonError.message, `(${anonError.code})`);
      
      if (anonError.code === '57014') {
        console.log('🚨 STILL TIMING OUT - optimization may not be sufficient');
      }
    } else {
      console.log(`✅ Anon COUNT succeeded (${duration}ms):`, anonCount);
      
      if (duration < 5000) {
        console.log('🎉 SIGNIFICANT PERFORMANCE IMPROVEMENT!');
      }
    }
  } catch (err) {
    console.log('❌ COUNT test exception:', err.message);
  }

  console.log('\n--- 2. Test INSERT Performance (The Critical Operation) ---');
  
  const testJobId = '3c3513cd-6f45-4733-8ae2-b09e229460a2';
  
  // Test multiple inserts to simulate RunPod behavior
  console.log('Testing multiple INSERT operations...');
  
  for (let i = 0; i < 5; i++) {
    const testStep = 800 + i;
    
    try {
      const insertStart = Date.now();
      const { error: insertError } = await anonClient
        .from('local_training_metrics')
        .insert({
          job_id: testJobId,
          step: testStep,
          epoch: 0,
          train_loss: 0.6 + (i * 0.01),
          learning_rate: 0.00005,
          timestamp: new Date().toISOString()
        });
      
      const insertDuration = Date.now() - insertStart;
      
      if (insertError) {
        console.log(`❌ Insert step ${testStep} failed (${insertDuration}ms):`, insertError.message, `(${insertError.code})`);
        
        if (insertError.code === '42501') {
          console.log('🚨 STILL RLS VIOLATION - policy optimization may need adjustment');
        }
        if (insertError.code === '57014') {
          console.log('🚨 STILL TIMING OUT - need further optimization');
        }
      } else {
        console.log(`✅ Insert step ${testStep} succeeded (${insertDuration}ms)`);
      }
    } catch (err) {
      console.log(`❌ Insert step ${testStep} exception:`, err.message);
    }
  }

  // Cleanup test data
  console.log('\nCleaning up test data...');
  await serviceClient
    .from('local_training_metrics')
    .delete()
    .eq('job_id', testJobId)
    .gte('step', 800);

  console.log('\n--- 3. Verify Current RLS Policies ---');
  
  try {
    const { data: policies, error: policyError } = await serviceClient
      .rpc('sql', { 
        query: `
          SELECT policyname, cmd, roles, with_check 
          FROM pg_policies 
          WHERE tablename = 'local_training_metrics' 
          AND policyname LIKE '%insert%'
          ORDER BY policyname
        `
      });
    
    if (policyError) {
      console.log('Policy check not available via RPC');
    } else {
      console.log('Current INSERT policies:', policies);
    }
  } catch (err) {
    console.log('Policy verification skipped');
  }

  console.log('\n--- 4. Test Concurrent Operations (Stress Test) ---');
  
  console.log('Testing concurrent inserts (simulating high-frequency RunPod metrics)...');
  
  const concurrentPromises = [];
  for (let i = 0; i < 10; i++) {
    const promise = anonClient
      .from('local_training_metrics')
      .insert({
        job_id: testJobId,
        step: 700 + i,
        epoch: 0,
        train_loss: 0.7 + (i * 0.001),
        learning_rate: 0.00005,
        timestamp: new Date().toISOString()
      });
    concurrentPromises.push(promise);
  }

  try {
    const concurrentStart = Date.now();
    const results = await Promise.allSettled(concurrentPromises);
    const concurrentDuration = Date.now() - concurrentStart;
    
    const successes = results.filter(r => r.status === 'fulfilled' && !r.value.error).length;
    const failures = results.filter(r => r.status === 'rejected' || r.value?.error).length;
    
    console.log(`Concurrent test (${concurrentDuration}ms): ${successes} succeeded, ${failures} failed`);
    
    if (failures === 0) {
      console.log('🎉 ALL CONCURRENT OPERATIONS SUCCEEDED - Fix is working!');
    } else {
      console.log('⚠️ Some concurrent operations failed - may need further tuning');
      
      // Show failure examples
      const failureExamples = results
        .filter(r => r.status === 'rejected' || r.value?.error)
        .slice(0, 3)
        .map(r => r.status === 'rejected' ? r.reason : r.value.error);
      
      console.log('Failure examples:', failureExamples);
    }

    // Cleanup concurrent test data
    await serviceClient
      .from('local_training_metrics')
      .delete()
      .eq('job_id', testJobId)
      .gte('step', 700);

  } catch (err) {
    console.log('❌ Concurrent test failed:', err.message);
  }

  console.log('\n=== OPTIMIZATION TEST COMPLETE ===');
  console.log('\nSUMMARY:');
  console.log('- If COUNT operations now complete quickly, the fix worked');
  console.log('- If INSERT operations succeed consistently, RunPod should work');
  console.log('- Monitor for any remaining timeout (57014) or RLS (42501) errors');
}

testOptimizedFix();