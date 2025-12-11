const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function verifyRLSFix() {
  console.log('🔍 VERIFYING RLS CONFIGURATION (SECURE)');
  console.log('='.repeat(60));

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  console.log('Testing current RLS status with anon key...\n');

  // Test 1: Check if we can read existing data (should work with proper RLS)
  console.log('1. Testing SELECT operations...');
  
  try {
    const { data: jobsData, error: jobsError } = await anonClient
      .from('local_training_jobs')
      .select('count', { count: 'exact', head: true });

    if (jobsError) {
      console.log('❌ Jobs SELECT failed:', jobsError.code, jobsError.message);
      if (jobsError.code === '42501') {
        console.log('🚨 RLS policies are blocking SELECT operations');
        console.log('💡 Need to create permissive RLS policies via Supabase Dashboard');
      }
    } else {
      console.log('✅ Jobs SELECT works, count:', jobsData);
    }

    const { data: metricsData, error: metricsError } = await anonClient
      .from('local_training_metrics')
      .select('count', { count: 'exact', head: true });

    if (metricsError) {
      console.log('❌ Metrics SELECT failed:', metricsError.code, metricsError.message);
    } else {
      console.log('✅ Metrics SELECT works, count:', metricsData);
    }

  } catch (error) {
    console.log('❌ SELECT test failed:', error.message);
  }

  // Test 2: Try INSERT operations (the main issue)
  console.log('\n2. Testing INSERT operations...');
  
  const testJobId = `verify-${Date.now()}`;
  
  try {
    // Try to create a job
    const { data: jobData, error: jobError } = await anonClient
      .from('local_training_jobs')
      .insert({
        id: testJobId,
        model_name: 'rls-test-model',
        status: 'pending',
        config: { test: true },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      console.log('❌ Job INSERT failed:', jobError.code, jobError.message);
      
      if (jobError.code === '42501') {
        console.log('\n🚨 RLS POLICY VIOLATION DETECTED');
        console.log('📋 TO FIX THIS ISSUE:');
        console.log('1. Go to Supabase Dashboard → SQL Editor');
        console.log('2. Copy the SQL from COMPREHENSIVE_RLS_FIX.sql');
        console.log('3. Execute the SQL to create proper RLS policies');
        console.log('4. Re-run this verification script');
        return;
      }
    } else {
      console.log('✅ Job INSERT works:', jobData.id);

      // Try to insert metrics
      const { data: metricsResult, error: metricsError } = await anonClient
        .from('local_training_metrics')
        .insert({
          job_id: testJobId,
          step: 1,
          loss: 0.5,
          learning_rate: 0.001,
          timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (metricsError) {
        console.log('❌ Metrics INSERT failed:', metricsError.code, metricsError.message);
      } else {
        console.log('✅ Metrics INSERT works:', metricsResult.id);
      }

      // Cleanup test data
      await anonClient.from('local_training_metrics').delete().eq('job_id', testJobId);
      await anonClient.from('local_training_jobs').delete().eq('id', testJobId);
      console.log('✅ Test data cleaned up');
    }

  } catch (error) {
    console.log('❌ INSERT test failed:', error.message);
  }

  console.log('\n📊 SUMMARY:');
  console.log('- If you see 42501 errors above, RLS policies need to be created');
  console.log('- Use Supabase Dashboard → SQL Editor to run COMPREHENSIVE_RLS_FIX.sql');
  console.log('- The fix creates secure policies that allow anon role access to training tables');
  console.log('- This maintains security while enabling RunPod training functionality');
}

verifyRLSFix();