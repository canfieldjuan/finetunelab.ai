// Check for environment-specific issues that might affect RunPod
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function debugEnvironmentIssues() {
  console.log('=== RUNPOD ENVIRONMENT DEBUG ===');
  console.log('Time:', new Date().toISOString());
  console.log();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const serviceClient = createClient(supabaseUrl, serviceKey);
  const anonClient = createClient(supabaseUrl, anonKey);

  // Check the specific job from the error logs
  const failingJobId = '3c3513cd-6f45-4733-8ae2-b09e229460a2';
  
  console.log('--- 1. Check Job State at Time of Failure ---');
  
  try {
    const { data: jobData, error: jobError } = await serviceClient
      .from('local_training_jobs')
      .select('*')
      .eq('id', failingJobId)
      .single();
    
    if (jobError) {
      console.log('❌ Job query failed:', jobError);
    } else {
      console.log('✅ Job found:', {
        id: jobData.id,
        status: jobData.status,
        created_at: jobData.created_at,
        updated_at: jobData.updated_at,
        job_token: jobData.job_token ? 'present' : 'missing',
        user_id: jobData.user_id
      });

      // Check if there are any existing metrics for this job
      const { data: existingMetrics, error: metricsError } = await serviceClient
        .from('local_training_metrics')
        .select('step, epoch, created_at')
        .eq('job_id', failingJobId)
        .order('step', { ascending: false })
        .limit(5);
      
      if (metricsError) {
        console.log('❌ Metrics query failed:', metricsError);
      } else {
        console.log('Existing metrics for this job:', existingMetrics?.length || 0, 'records');
        if (existingMetrics && existingMetrics.length > 0) {
          console.log('Latest metrics:', existingMetrics);
        }
      }
    }
  } catch (err) {
    console.log('❌ Job check exception:', err);
  }

  console.log('\n--- 2. Test Concurrent Access Pattern ---');
  
  // The error happened at step 190, let's see if there's a concurrency issue
  console.log('Testing concurrent insertions (simulating RunPod behavior)...');
  
  const promises = [];
  for (let i = 0; i < 5; i++) {
    const testStep = 990 + i;
    const promise = anonClient
      .from('local_training_metrics')
      .insert({
        job_id: failingJobId,
        step: testStep,
        epoch: 0,
        train_loss: 0.5 + (i * 0.01),
        learning_rate: 0.00005,
        timestamp: new Date().toISOString()
      });
    promises.push(promise);
  }

  try {
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, i) => {
      const step = 990 + i;
      if (result.status === 'fulfilled') {
        if (result.value.error) {
          console.log(`❌ Step ${step} failed:`, result.value.error);
        } else {
          console.log(`✅ Step ${step} succeeded`);
        }
      } else {
        console.log(`❌ Step ${step} rejected:`, result.reason);
      }
    });

    // Cleanup
    await serviceClient
      .from('local_training_metrics')
      .delete()
      .eq('job_id', failingJobId)
      .gte('step', 990);
    console.log('Cleanup completed');

  } catch (err) {
    console.log('❌ Concurrent test failed:', err);
  }

  console.log('\n--- 3. Check Database Constraints and Triggers ---');
  
  // Check if there are any database constraints that might be causing issues
  try {
    const { data: constraintTest } = await serviceClient
      .rpc('sql', {
        query: `
          SELECT constraint_name, constraint_type 
          FROM information_schema.table_constraints 
          WHERE table_name = 'local_training_metrics'
        `
      });
    console.log('Table constraints:', constraintTest);
  } catch (err) {
    console.log('Constraint check not available');
  }

  console.log('\n--- 4. Test Edge Cases ---');
  
  // Test with exact data from the error logs
  const exactFailureData = {
    job_id: failingJobId,
    step: 190,
    epoch: 0,
    train_loss: 0.568,
    learning_rate: 0.00005, // From the logs: "Updated step 190 - Loss: 0.568"
    timestamp: new Date().toISOString()
  };

  console.log('Testing with exact failure data:', exactFailureData);
  
  try {
    const { error } = await anonClient
      .from('local_training_metrics')
      .insert(exactFailureData);
    
    if (error) {
      console.log('❌ Exact failure data failed:', error);
    } else {
      console.log('✅ Exact failure data succeeded');
      
      // Cleanup
      await serviceClient
        .from('local_training_metrics')
        .delete()
        .eq('job_id', failingJobId)
        .eq('step', 190);
    }
  } catch (err) {
    console.log('❌ Exact failure test exception:', err);
  }

  console.log('\n--- 5. Check for Rate Limiting or Connection Issues ---');
  
  // Rapid-fire requests to see if there are rate limits
  console.log('Testing rapid requests...');
  const rapidPromises = [];
  
  for (let i = 0; i < 10; i++) {
    rapidPromises.push(
      anonClient.from('local_training_metrics').select('count', { count: 'exact', head: true })
    );
  }

  try {
    const rapidResults = await Promise.allSettled(rapidPromises);
    const successes = rapidResults.filter(r => r.status === 'fulfilled' && !r.value.error).length;
    const failures = rapidResults.filter(r => r.status === 'rejected' || r.value?.error).length;
    
    console.log(`Rapid requests: ${successes} succeeded, ${failures} failed`);
    
    if (failures > 0) {
      console.log('Failure examples:', rapidResults.filter(r => r.status === 'rejected' || r.value?.error).slice(0, 3));
    }
  } catch (err) {
    console.log('❌ Rapid test failed:', err);
  }

  console.log('\n=== ENVIRONMENT DEBUG COMPLETE ===');
}

debugEnvironmentIssues();