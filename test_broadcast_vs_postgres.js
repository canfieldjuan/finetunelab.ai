import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing BROADCAST (not postgres_changes)...\n');

const supabase = createClient(supabaseUrl, serviceKey, {
  realtime: {
    timeout: 20000,
    heartbeatIntervalMs: 5000
  }
});

const channel = supabase
  .channel('test-broadcast')
  .on('broadcast', { event: 'test' }, (payload) => {
    console.log('✅ Received broadcast!', payload);
    console.log('\n🎉 Broadcast works! Now testing if we can trigger postgres_changes...\n');
    channel.unsubscribe();
    setTimeout(() => testPostgresChanges(), 1000);
  })
  .subscribe((status, err) => {
    console.log('Broadcast channel status:', status);
    if (err) console.error('Error:', err);
    
    if (status === 'SUBSCRIBED') {
      console.log('✅ Broadcast channel subscribed! Sending test message...\n');
      channel.send({
        type: 'broadcast',
        event: 'test',
        payload: { message: 'Hello from broadcast!' }
      });
    }
  });

function testPostgresChanges() {
  console.log('Now testing postgres_changes subscription...\n');
  
  const pgChannel = supabase
    .channel('test-pg-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'local_training_jobs' },
      (payload) => {
        console.log('✅ Received postgres_changes event!', payload);
      }
    )
    .subscribe((status, err) => {
      console.log('postgres_changes status:', status);
      if (err) console.error('Error:', err);
      
      if (status === 'SUBSCRIBED') {
        console.log('✅ postgres_changes subscription WORKS!');
        console.log('The issue was something else entirely.\n');
        pgChannel.unsubscribe();
        process.exit(0);
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        console.error('\n❌ postgres_changes still fails even though broadcast works.');
        console.error('This confirms postgres_changes is disabled or requires additional setup.\n');
        pgChannel.unsubscribe();
        process.exit(1);
      }
    });
  
  setTimeout(() => {
    console.error('\n⏱️  postgres_changes timed out after 22 seconds\n');
    pgChannel.unsubscribe();
    process.exit(1);
  }, 22000);
}

setTimeout(() => {
  console.error('\n⏱️  Broadcast timed out - Realtime completely broken\n');
  channel.unsubscribe();
  process.exit(1);
}, 25000);
