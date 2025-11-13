import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Checking Realtime Configuration...\n');

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Test with a specific table subscription
async function testRealtimeWithTable() {
  console.log('='.repeat(80));
  console.log('TESTING REALTIME WITH ACTUAL TRAINING TABLE');
  console.log('='.repeat(80));
  console.log('');

  const channel = supabase
    .channel('test-training-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'local_training_jobs'
      },
      (payload) => {
        console.log('✅ Received realtime event:', payload);
      }
    )
    .subscribe((status, err) => {
      console.log('Subscription status:', status);
      if (err) {
        console.error('Subscription error:', err);
      }
      
      if (status === 'SUBSCRIBED') {
        console.log('');
        console.log('✅ SUCCESS! Realtime is WORKING!');
        console.log('✅ Connected to local_training_jobs table');
        console.log('');
        console.log('This means:');
        console.log('  - Realtime feature is enabled in Supabase');
        console.log('  - Tables are in the publication');
        console.log('  - Your training dashboard should work now!');
        console.log('');
        setTimeout(() => {
          channel.unsubscribe();
          process.exit(0);
        }, 2000);
      } else if (status === 'TIMED_OUT') {
        console.log('');
        console.error('❌ TIMEOUT - Realtime is NOT enabled');
        console.error('');
        console.error('Even though tables are in publication, the Realtime feature');
        console.error('itself may not be enabled at the project level.');
        console.error('');
        console.error('Check: Project Settings > API > Realtime toggle');
        process.exit(1);
      } else if (status === 'CHANNEL_ERROR') {
        console.log('');
        console.error('❌ CHANNEL ERROR:', err);
        console.error('');
        console.error('Possible issues:');
        console.error('  1. RLS policies blocking realtime');
        console.error('  2. Realtime not enabled for this project');
        console.error('  3. Network/connection issues');
        process.exit(1);
      }
    });

  // Timeout after 65 seconds
  setTimeout(() => {
    console.error('');
    console.error('⏱️  Test timed out after 65 seconds');
    console.error('');
    console.error('This usually means Realtime is not enabled or not working.');
    console.error('The tables are in the publication, but the connection fails.');
    channel.unsubscribe();
    process.exit(1);
  }, 65000);
}

testRealtimeWithTable();
