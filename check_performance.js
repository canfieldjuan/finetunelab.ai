// Check table size and performance issues
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkTablePerformance() {
  console.log('=== TABLE PERFORMANCE ANALYSIS ===');
  console.log('Time:', new Date().toISOString());
  console.log();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  const serviceClient = createClient(supabaseUrl, serviceKey);
  const anonClient = createClient(supabaseUrl, anonKey);

  console.log('--- 1. Check Table Size (Service Role) ---');
  
  try {
    // Use service role to get accurate count (bypasses RLS)
    const start = Date.now();
    const { data: serviceCount, error: serviceError } = await serviceClient
      .from('local_training_metrics')
      .select('count', { count: 'exact' });
    
    const serviceTime = Date.now() - start;
    
    if (serviceError) {
      console.log('❌ Service role count failed:', serviceError);
    } else {
      console.log(`✅ Service role count: ${serviceCount || 'unknown'} records (${serviceTime}ms)`);
    }
  } catch (err) {
    console.log('❌ Service role exception:', err.message);
  }

  console.log('\n--- 2. Check Table Size (Anon Role) ---');
  
  try {
    // This is what might be causing the issue in RunPod
    const start = Date.now();
    const { data: anonCount, error: anonError } = await anonClient
      .from('local_training_metrics')
      .select('count', { count: 'exact' });
    
    const anonTime = Date.now() - start;
    
    if (anonError) {
      console.log('❌ Anon role count failed:', anonError);
      console.log('This might be the root cause of RunPod failures!');
    } else {
      console.log(`✅ Anon role count: ${anonCount || 'unknown'} records (${anonTime}ms)`);
    }
  } catch (err) {
    console.log('❌ Anon role exception:', err.message);
  }

  console.log('\n--- 3. Check Recent Records ---');
  
  try {
    const { data: recentRecords, error: recentError } = await serviceClient
      .from('local_training_metrics')
      .select('job_id, step, epoch, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (recentError) {
      console.log('❌ Recent records failed:', recentError);
    } else {
      console.log('Recent metrics records:', recentRecords?.length || 0);
      if (recentRecords && recentRecords.length > 0) {
        console.log('Sample records:');
        recentRecords.forEach((record, i) => {
          console.log(`  ${i + 1}. Job: ${record.job_id?.substring(0, 8)}... Step: ${record.step} Created: ${record.created_at?.substring(0, 19)}`);
        });
      }
    }
  } catch (err) {
    console.log('❌ Recent records exception:', err.message);
  }

  console.log('\n--- 4. Test INSERT Without Count Operations ---');
  
  const testJobId = '3c3513cd-6f45-4733-8ae2-b09e229460a2';
  
  // Test if the issue is specifically with COUNT queries during INSERT
  console.log('Testing INSERT operation (the actual failing operation)...');
  
  try {
    const insertStart = Date.now();
    const { error: insertError } = await anonClient
      .from('local_training_metrics')
      .insert({
        job_id: testJobId,
        step: 888,
        epoch: 0,
        train_loss: 0.777,
        learning_rate: 0.00005,
        timestamp: new Date().toISOString()
      });
    
    const insertTime = Date.now() - insertStart;
    
    if (insertError) {
      console.log(`❌ INSERT failed (${insertTime}ms):`, insertError);
      
      // Check if it's the RLS error we've been seeing
      if (insertError.code === '42501') {
        console.log('🎯 THIS IS THE RLS ERROR FROM RUNPOD!');
      }
    } else {
      console.log(`✅ INSERT succeeded (${insertTime}ms)`);
      
      // Cleanup
      await serviceClient
        .from('local_training_metrics')
        .delete()
        .eq('job_id', testJobId)
        .eq('step', 888);
    }
  } catch (err) {
    console.log('❌ INSERT exception:', err.message);
  }

  console.log('\n--- 5. Check Database Performance Stats ---');
  
  try {
    // Check for indexes and table stats
    const { data: oldestRecord } = await serviceClient
      .from('local_training_metrics')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1);

    const { data: newestRecord } = await serviceClient
      .from('local_training_metrics')  
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (oldestRecord && newestRecord) {
      console.log('Data range:');
      console.log('- Oldest record:', oldestRecord[0]?.created_at);
      console.log('- Newest record:', newestRecord[0]?.created_at);
      
      const oldDate = new Date(oldestRecord[0]?.created_at);
      const newDate = new Date(newestRecord[0]?.created_at);
      const daysDiff = Math.round((newDate - oldDate) / (1000 * 60 * 60 * 24));
      console.log('- Data span:', daysDiff, 'days');
    }
  } catch (err) {
    console.log('Database stats not available:', err.message);
  }

  console.log('\n=== TABLE PERFORMANCE ANALYSIS COMPLETE ===');
  console.log('\nKEY FINDINGS:');
  console.log('- If anon COUNT operations timeout, this explains RunPod failures');
  console.log('- Large table + RLS policy evaluation may cause performance issues');
  console.log('- RunPod Python client may be doing internal COUNT operations');
}

checkTablePerformance();