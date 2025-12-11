// Test Timing Issue - Check if job exists when metrics insertion fails
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testTimingIssue() {
  console.log('=== TIMING ISSUE INVESTIGATION ===');
  console.log('Time:', new Date().toISOString());
  console.log();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabaseService = createClient(supabaseUrl, serviceKey);
  const supabaseAnon = createClient(supabaseUrl, anonKey);

  try {
    // Test the exact failing job ID from the error logs
    const failingJobId = '3c3513cd-6f45-4733-8ae2-b09e229460a2';
    
    console.log('--- 1. Check if failing job exists in database ---');
    const { data: jobExists, error: jobError } = await supabaseService
      .from('local_training_jobs')
      .select('id, status, job_token, user_id, created_at')
      .eq('id', failingJobId)
      .single();
    
    if (jobError) {
      console.log('❌ Job does NOT exist:', jobError.message);
      console.log('This explains the RLS failure - policy checks for job existence');
    } else {
      console.log('✅ Job EXISTS:', {
        id: jobExists.id,
        status: jobExists.status,
        created_at: jobExists.created_at
      });
      
      // If job exists, test if anon can insert metrics for it
      console.log('\n--- 2. Test metrics insertion with anon key ---');
      const { error: metricsError } = await supabaseAnon
        .from('local_training_metrics')
        .insert({
          job_id: failingJobId,
          step: 999,
          epoch: 999,
          current_loss: 0.123,
          learning_rate: 0.001,
          recorded_at: new Date().toISOString()
        });
      
      if (metricsError) {
        console.log('❌ Metrics insertion FAILED:', metricsError);
      } else {
        console.log('✅ Metrics insertion SUCCEEDED');
        
        // Cleanup test metric
        await supabaseService
          .from('local_training_metrics')
          .delete()
          .eq('job_id', failingJobId)
          .eq('step', 999);
        console.log('Test metric cleaned up');
      }
    }

    console.log('\n--- 3. Check recent jobs to understand the pattern ---');
    const { data: recentJobs } = await supabaseService
      .from('local_training_jobs')
      .select('id, status, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log('Recent jobs:', recentJobs?.map(j => ({
      id: j.id.substring(0, 8) + '...',
      status: j.status,
      created: j.created_at?.substring(0, 19)
    })));

    console.log('\n--- 4. Test with a real existing job ---');
    if (recentJobs && recentJobs.length > 0) {
      const testJob = recentJobs[0];
      console.log('Testing with existing job:', testJob.id.substring(0, 8) + '...');
      
      const { error: testError } = await supabaseAnon
        .from('local_training_metrics')
        .insert({
          job_id: testJob.id,
          step: 888,
          epoch: 888,
          current_loss: 0.456,
          learning_rate: 0.001,
          recorded_at: new Date().toISOString()
        });
      
      if (testError) {
        console.log('❌ Test metrics insertion FAILED:', testError);
      } else {
        console.log('✅ Test metrics insertion SUCCEEDED');
        
        // Cleanup
        await supabaseService
          .from('local_training_metrics')
          .delete()
          .eq('job_id', testJob.id)
          .eq('step', 888);
        console.log('Test metric cleaned up');
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
  }

  console.log('\n=== INVESTIGATION COMPLETE ===');
}

testTimingIssue();