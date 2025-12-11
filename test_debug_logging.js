import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing with explicit socket constructor and logging...\n');

// Enable debug mode
const supabase = createClient(supabaseUrl, anonKey, {
  realtime: {
    timeout: 15000,
    logger: (level, msg, data) => {
      console.log(`[Realtime ${level}]`, msg, data ? JSON.stringify(data) : '');
    }
  }
});

console.log('Created client, subscribing to channel...\n');

const channel = supabase
  .channel('debug-test')
  .subscribe((status, err) => {
    console.log('\n[Subscribe callback] Status:', status);
    if (err) console.error('[Subscribe callback] Error:', err);
    
    if (status === 'SUBSCRIBED') {
      console.log('\n✅ SUBSCRIBED!\n');
      channel.unsubscribe();
      process.exit(0);
    } else if (status === 'TIMED_OUT') {
      console.error('\n❌ TIMED_OUT\n');
      channel.unsubscribe();
      process.exit(1);
    }
  });

setTimeout(() => {
  console.error('\n⏱️  Manual timeout after 20s\n');
  channel.unsubscribe();
  process.exit(1);
}, 20000);
