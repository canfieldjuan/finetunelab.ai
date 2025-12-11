import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing postgres_changes with SERVICE ROLE (no filters)...\n');

const supabase = createClient(supabaseUrl, serviceKey, {
  realtime: {
    timeout: 20000,
    heartbeatIntervalMs: 5000
  }
});

const channel = supabase
  .channel('test-postgres-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'local_training_jobs'
    },
    (payload) => {
      console.log('✅ Received postgres_changes event!', payload);
    }
  )
  .subscribe((status, err) => {
    console.log('Status:', status);
    if (err) console.error('Error:', err);
    
    if (status === 'SUBSCRIBED') {
      console.log('');
      console.log('🎉 postgres_changes subscription WORKS!');
      console.log('');
      console.log('This means the issue is likely:');
      console.log('1. Filters might be causing problems');
      console.log('2. Or the user token has insufficient permissions');
      console.log('');
      setTimeout(() => {
        channel.unsubscribe();
        process.exit(0);
      }, 2000);
    } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
      console.log('');
      console.error('❌ Even service role with no filters fails!');
      console.error('');
      console.error('This suggests a server-side configuration issue:');
      console.error('- Realtime server might not have access to the tables');
      console.error('- Or there\'s a replication slot/WAL issue');
      console.error('- Or the publication isn\'t actually active');
      console.error('');
      channel.unsubscribe();
      process.exit(1);
    }
  });

setTimeout(() => {
  console.error('');
  console.error('⏱️  Timed out after 22 seconds');
  channel.unsubscribe();
  process.exit(1);
}, 22000);
