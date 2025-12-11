/**
 * Test script to verify Supabase Realtime connection
 * Run with: npx tsx scripts/test-supabase-connection.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
  process.exit(1);
}

console.log('🔧 Testing Supabase Connection');
console.log('URL:', supabaseUrl);
console.log('');

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

async function testConnection() {
  console.log('1️⃣  Testing basic database query...');
  
  const { data: jobs, error: jobsError } = await supabase
    .from('local_training_jobs')
    .select('id, status')
    .limit(1);

  if (jobsError) {
    console.error('❌ Database query failed:', jobsError);
    return false;
  }
  
  console.log('✅ Database query successful');
  console.log('   Jobs found:', jobs?.length || 0);
  console.log('');

  console.log('2️⃣  Testing Realtime connection...');
  
  return new Promise((resolve) => {
    let timeoutId: NodeJS.Timeout;
    
    const channel = supabase
      .channel(`test-connection-${Date.now()}`, {
        config: {
          broadcast: { self: false },
          presence: { key: '' }
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'local_training_jobs'
        },
        (payload) => {
          console.log('📨 Received change:', payload);
        }
      )
      .subscribe((status, err) => {
        console.log(`   Subscription status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime connection successful!');
          clearTimeout(timeoutId);
          
          setTimeout(() => {
            channel.unsubscribe();
            resolve(true);
          }, 2000);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error:', err);
          clearTimeout(timeoutId);
          channel.unsubscribe();
          resolve(false);
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Connection timed out');
          clearTimeout(timeoutId);
          channel.unsubscribe();
          resolve(false);
        } else if (status === 'CLOSED') {
          console.log('⚠️  Connection closed');
        }
      });

    // Set a manual timeout
    timeoutId = setTimeout(() => {
      console.error('❌ Manual timeout (30s) - connection is taking too long');
      channel.unsubscribe();
      resolve(false);
    }, 30000);
  });
}

testConnection()
  .then((success) => {
    console.log('');
    console.log('='.repeat(50));
    console.log(success ? '✅ All tests passed!' : '❌ Some tests failed');
    console.log('='.repeat(50));
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
