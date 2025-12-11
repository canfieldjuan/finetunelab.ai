// Test exact RunPod metrics insertion format
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testExactRunPodFormat() {
  console.log('=== TEST EXACT RUNPOD METRICS FORMAT ===');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseAnon = createClient(supabaseUrl, anonKey);

  try {
    // Use the exact job ID from the failing logs
    const jobId = '3c3513cd-6f45-4733-8ae2-b09e229460a2';
    
    console.log('Testing with failing job ID:', jobId);

    // Create the exact metrics_insert format from RunPod script
    const metricsInsert = {
      'job_id': jobId,
      'step': 190,
      'epoch': 0,
      'train_loss': 0.568,
      'eval_loss': null,
      'perplexity': null,
      'train_perplexity': 1.765, // exp(0.568)
      'learning_rate': 0.00005,
      'grad_norm': 1.2,
      'samples_per_second': 1.5,
      'gpu_memory_allocated_gb': 2.1,
      'gpu_memory_reserved_gb': 11.3,
      'timestamp': new Date().toISOString(),
    };
    
    // Remove null values like RunPod script does
    const cleanedInsert = Object.fromEntries(
      Object.entries(metricsInsert).filter(([k, v]) => v !== null)
    );
    
    console.log('Inserting metrics:', cleanedInsert);

    const { data, error } = await supabaseAnon
      .from('local_training_metrics')
      .insert(cleanedInsert);
    
    if (error) {
      console.log('❌ EXACT RUNPOD FORMAT FAILED:', error);
      
      // Check if it's still an RLS issue
      if (error.code === '42501') {
        console.log('This is the RLS violation we need to fix!');
        
        // Let's check if the job actually exists in the table right now
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseService = createClient(supabaseUrl, serviceKey);
        
        const { data: jobCheck } = await supabaseService
          .from('local_training_jobs')
          .select('id, status')
          .eq('id', jobId)
          .single();
        
        console.log('Job exists check:', jobCheck);
      }
    } else {
      console.log('✅ EXACT RUNPOD FORMAT SUCCEEDED:', data);
      
      // Clean up test data
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseService = createClient(supabaseUrl, serviceKey);
      await supabaseService
        .from('local_training_metrics')
        .delete()
        .eq('job_id', jobId)
        .eq('step', 190);
      console.log('Test metrics cleaned up');
    }

  } catch (error) {
    console.error('Test failed:', error);
  }

  console.log('\n=== TEST COMPLETE ===');
}

testExactRunPodFormat();