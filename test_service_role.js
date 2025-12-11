import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing with SERVICE_ROLE key and debug logging...\n');

const supabase = createClient(supabaseUrl, serviceKey, {
  realtime: {
    timeout: 15000,
    logger: (level, msg, data) => {
      console.log(`[${level}]`, msg, data ? JSON.stringify(data, null, 2) : '');
    }
  }
});

const channel = supabase
  .channel('service-role-test')
  .subscribe((status, err) => {
    console.log('\nStatus:', status);
    if (err) console.error('Error:', JSON.stringify(err, null, 2));
    
    if (status === 'SUBSCRIBED') {
      console.log('\n✅ SERVICE ROLE WORKS!\n');
      channel.unsubscribe();
      process.exit(0);
    } else if (status === 'TIMED_OUT') {
      console.error('\n❌ Even service role times out\n');
      channel.unsubscribe();
      process.exit(1);
    }
  });

setTimeout(() => {
  console.error('\n⏱️  Timeout\n');
  channel.unsubscribe();
  process.exit(1);
}, 20000);
