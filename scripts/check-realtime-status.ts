#!/usr/bin/env npx tsx

/**
 * Check if realtime is enabled for training tables
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRealtimeStatus() {
  console.log('🔍 Checking realtime configuration...\n');

  try {
    // Try to fetch a sample job to test permissions
    console.log('1️⃣ Testing SELECT permission...');
    const { data: jobs, error: selectError } = await supabase
      .from('local_training_jobs')
      .select('id, status, job_token')
      .limit(1);

    if (selectError) {
      console.error('❌ SELECT failed:', selectError.message);
    } else {
      console.log(`✅ SELECT works (found ${jobs?.length || 0} jobs)`);
      if (jobs && jobs.length > 0) {
        console.log('   Sample job ID:', jobs[0].id);
      }
    }

    // Test UPDATE permission with a dummy job_token
    console.log('\n2️⃣ Testing UPDATE permission...');
    console.log('   (This will fail if no matching job, but shows if permission exists)');

    const { data: updateData, error: updateError } = await supabase
      .from('local_training_jobs')
      .update({ progress: 0.01 })
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .eq('job_token', 'test-token')
      .select();

    if (updateError) {
      // Check if it's a permission error or just no rows matched
      if (updateError.message.includes('permission') || updateError.message.includes('policy')) {
        console.error('❌ UPDATE permission denied:', updateError.message);
      } else {
        console.log('✅ UPDATE permission exists (no rows matched, which is expected)');
      }
    } else {
      console.log('✅ UPDATE works');
    }

    // Test realtime subscription
    console.log('\n3️⃣ Testing realtime subscription...');
    console.log('   Creating test subscription...');

    const testChannel = supabase
      .channel(`test-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'local_training_jobs',
        },
        (payload) => {
          console.log('   📡 Received update:', payload);
        }
      )
      .subscribe((status, err) => {
        console.log('   Subscription status:', status);
        if (err) {
          console.error('   ❌ Subscription error:', err);
        }

        if (status === 'SUBSCRIBED') {
          console.log('   ✅ Realtime subscription works!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('   ❌ Realtime NOT enabled or RLS blocking');
          console.log('\n   💡 You need to enable realtime in Supabase dashboard:');
          console.log('      Database > Replication > local_training_jobs > Enable');
        }

        // Cleanup after 2 seconds
        setTimeout(() => {
          testChannel.unsubscribe();
          console.log('\n✅ Check complete!');
          process.exit(0);
        }, 2000);
      });

  } catch (error: unknown) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRealtimeStatus();
