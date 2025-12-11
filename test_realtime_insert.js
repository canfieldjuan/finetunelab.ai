// Test Realtime by inserting a dummy metric
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRealtimeWithInsert() {
  const jobId = 'ec3495a9-24d2-44b3-a246-cb31237bbaa1';
  
  console.log('🧪 Testing Realtime by inserting a test metric...\n');
  console.log('Keep your browser console open to see the realtime event!\n');
  
  // Wait 5 seconds for you to open the page
  console.log('⏳ Waiting 5 seconds for you to open the training monitor page...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('\n📊 Inserting test metric NOW...');
  
  const { data, error } = await supabase
    .from('local_training_metrics')
    .insert({
      job_id: jobId,
      step: 99999,
      epoch: 0,
      train_loss: 0.001,
      learning_rate: 0.00001,
      grad_norm: 1.0,
      gpu_memory_allocated_gb: 3.26,
      gpu_memory_reserved_gb: 20.58,
      samples_per_second: 0.16,
      train_perplexity: 1.0
    })
    .select();
  
  if (error) {
    console.error('❌ Insert failed:', error);
  } else {
    console.log('✅ Test metric inserted!');
    console.log('   Check your browser console for:');
    console.log('   📊 NEW METRIC INSERT EVENT:');
    console.log('   📈 STATE UPDATE: metrics array length');
    console.log('\nIf you see those logs, realtime is working! 🎉');
  }
}

testRealtimeWithInsert();
