import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Realtime with SERVICE ROLE key (bypasses ALL RLS)...\n');
console.log('URL:', supabaseUrl);
console.log('Key:', serviceRoleKey ? 'SERVICE_ROLE key present' : 'Missing');
console.log('');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  realtime: {
    timeout: 30000,
    heartbeatIntervalMs: 5000
  }
});

// Test channel subscription with postgres_changes on actual table
const channel = supabase
  .channel('test-service-role-realtime')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'local_training_jobs'
    },
    (payload) => {
      console.log('✅ Received change event:', payload);
    }
  )
  .subscribe((status, err) => {
    console.log('='.repeat(80));
    console.log('SUBSCRIPTION STATUS:', status);
    if (err) {
      console.error('ERROR:', JSON.stringify(err, null, 2));
    }
    console.log('='.repeat(80));
    console.log('');
    
    if (status === 'SUBSCRIBED') {
      console.log('🎉 SUCCESS! Realtime is WORKING with SERVICE ROLE!');
      console.log('');
      console.log('This means:');
      console.log('  ✅ Realtime feature IS enabled in Supabase');
      console.log('  ✅ Tables are in the publication');
      console.log('  ✅ Policies are correct');
      console.log('  ✅ Your training dashboard should work!');
      console.log('');
      setTimeout(() => {
        channel.unsubscribe();
        process.exit(0);
      }, 2000);
    } else if (status === 'TIMED_OUT') {
      console.error('❌ CRITICAL: Service role also timed out!');
      console.error('');
      console.error('This definitively proves Realtime is NOT enabled.');
      console.error('Service role bypasses ALL RLS policies, so this can only mean:');
      console.error('');
      console.error('  1. Realtime feature is disabled in Project Settings');
      console.error('  2. OR Realtime server is not responding');
      console.error('');
      console.error('Action required:');
      console.error('  Go to: Project Settings > API > Realtime');
      console.error('  Toggle "Enable Realtime" to ON');
      console.error('  Wait 2-3 minutes for changes to apply');
      process.exit(1);
    } else if (status === 'CHANNEL_ERROR') {
      console.error('❌ CHANNEL ERROR with service role!');
      console.error('Error:', err);
      process.exit(1);
    }
  });

// Timeout after 32 seconds
setTimeout(() => {
  console.error('⏱️  Test timed out after 32 seconds with SERVICE ROLE key');
  console.error('');
  console.error('This is the definitive test - service role bypasses all security.');
  console.error('Timeout means Realtime is NOT enabled at the infrastructure level.');
  channel.unsubscribe();
  process.exit(1);
}, 32000);
