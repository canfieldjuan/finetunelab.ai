import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing with explicit WebSocket constructor...\n');

// Pass WebSocket constructor explicitly for Node.js
const supabase = createClient(supabaseUrl, anonKey, {
  realtime: {
    timeout: 15000,
    transport: WebSocket,  // Explicitly pass WebSocket constructor
    logger: (level, msg, data) => {
      console.log(`[${level}]`, msg, data ? JSON.stringify(data, null, 2).substring(0, 200) : '');
    }
  }
});

const channel = supabase
  .channel('explicit-ws-test')
  .subscribe((status, err) => {
    console.log('\nStatus:', status);
    if (err) console.error('Error:', err);
    
    if (status === 'SUBSCRIBED') {
      console.log('\n✅ WORKS with explicit WebSocket constructor!\n');
      channel.unsubscribe();
      process.exit(0);
    } else if (status === 'TIMED_OUT') {
      console.error('\n❌ Still times out\n');
      channel.unsubscribe();
      process.exit(1);
    }
  });

setTimeout(() => {
  console.error('\n⏱️  Timeout\n');
  channel.unsubscribe();
  process.exit(1);
}, 20000);
