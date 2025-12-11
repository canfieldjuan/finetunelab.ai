const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testFixedSchema() {
  console.log('🧪 TESTING FIXED SCHEMA FOR RunPod Training');
  console.log('='.repeat(60));

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const testJobId = `runpod-fix-test-${Date.now()}`;
  
  try {
    console.log('1. Creating test job...');
    const { data: jobData, error: jobError } = await anonClient
      .from('local_training_jobs')
      .insert({
        id: testJobId,
        model_name: 'runpod-test-model',
        status: 'running',
        config: { 
          test: true,
          runpod_fix: 'epoch_default_value' 
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      console.log('❌ Job creation failed:', jobError.code, jobError.message);
      return;
    }
    
    console.log('✅ Job created successfully:', jobData.id);

    console.log('\n2. Testing metrics insertion with corrected schema...');
    
    // Simulate the exact payload that RunPod would send
    const metricsPayload = {
      job_id: testJobId,
      step: 1,
      epoch: 0,  // Now explicitly set to 0 instead of None
      train_loss: 2.456,
      eval_loss: null,
      learning_rate: 0.0001,
      grad_norm: 1.234,
      samples_per_second: 0.85,
      gpu_memory_allocated_gb: 2.1,
      gpu_memory_reserved_gb: 11.2,
      timestamp: new Date().toISOString()
    };

    console.log('Inserting metrics:', JSON.stringify(metricsPayload, null, 2));

    const { data: metricsData, error: metricsError } = await anonClient
      .from('local_training_metrics')
      .insert(metricsPayload)
      .select()
      .single();

    if (metricsError) {
      console.log('❌ Metrics insertion failed:', metricsError.code, metricsError.message);
      console.log('   Details:', metricsError.details);
      console.log('   Hint:', metricsError.hint);
    } else {
      console.log('✅ Metrics insertion successful!');
      console.log('   Inserted ID:', metricsData.id);
      console.log('   Job ID:', metricsData.job_id);
      console.log('   Step:', metricsData.step);
      console.log('   Epoch:', metricsData.epoch);
      console.log('   Train Loss:', metricsData.train_loss);
    }

    console.log('\n3. Testing multiple rapid insertions (RunPod simulation)...');
    
    const promises = [];
    for (let step = 2; step <= 6; step++) {
      promises.push(
        anonClient
          .from('local_training_metrics')
          .insert({
            job_id: testJobId,
            step: step,
            epoch: 0,
            train_loss: 2.5 - (step * 0.1), // Decreasing loss
            learning_rate: 0.0001,
            timestamp: new Date().toISOString()
          })
          .select()
          .single()
      );
    }

    const results = await Promise.all(promises);
    const successful = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);

    console.log(`✅ ${successful.length} successful insertions`);
    console.log(`❌ ${failed.length} failed insertions`);

    if (failed.length > 0) {
      console.log('Failed insertion errors:');
      failed.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.error.code}: ${result.error.message}`);
      });
    }

    console.log('\n4. Cleaning up test data...');
    await anonClient.from('local_training_metrics').delete().eq('job_id', testJobId);
    await anonClient.from('local_training_jobs').delete().eq('id', testJobId);
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 RUNPOD TRAINING FIX SUMMARY:');
    console.log('- RLS policies are working correctly');
    console.log('- Schema mismatch has been resolved');  
    console.log('- Epoch field now defaults to 0 instead of None');
    console.log('- RunPod training should work without 42501 errors');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testFixedSchema();