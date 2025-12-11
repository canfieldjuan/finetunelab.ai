import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing supabase-js with simple broadcast (like raw WebSocket test)...\n');

const supabase = createClient(supabaseUrl, anonKey, {
  realtime: {
    timeout: 15000
  }
});

const channel = supabase
  .channel('simple-test', {
    config: {
      broadcast: { self: true },
      presence: { key: '' }
    }
  })
  .on('broadcast', { event: 'test' }, (payload) => {
    console.log('✅ Received broadcast via supabase-js!', payload);
  })
  .subscribe(async (status, err) => {
    console.log('Status:', status);
    if (err) console.error('Error:', err);
    
    if (status === 'SUBSCRIBED') {
      console.log('✅ Subscribed! Sending test broadcast...\n');
      
      await channel.send({
        type: 'broadcast',
        event: 'test',
        payload: { message: 'Hello from supabase-js!' }
      });
      
      setTimeout(() => {
        console.log('\n✅ Test complete - supabase-js broadcast works!');
        channel.unsubscribe();
        process.exit(0);
      }, 2000);
    } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
      console.error('\n❌ supabase-js subscription failed even though raw WebSocket works!');
      console.error('This indicates a client library configuration issue.\n');
      channel.unsubscribe();
      process.exit(1);
    }
  });

setTimeout(() => {
  console.error('\n⏱️  Timed out after 20 seconds\n');
  channel.unsubscribe();
  process.exit(1);
}, 20000);
