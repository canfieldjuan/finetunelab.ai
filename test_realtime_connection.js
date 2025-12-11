// Test Supabase Realtime Connection
// Run this in browser console or node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load from .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing Supabase Realtime Connection');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey ? 'Present' : 'Missing');

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    timeout: 60000,
    heartbeatIntervalMs: 15000
  }
});

// Test channel subscription
const channel = supabase.channel('test-realtime-connection')
  .subscribe((status, err) => {
    console.log('');
    console.log('='.repeat(80));
    console.log('SUBSCRIPTION STATUS:', status);
    if (err) {
      console.error('ERROR:', err);
    }
    console.log('='.repeat(80));
    console.log('');
    
    if (status === 'SUBSCRIBED') {
      console.log('✅ SUCCESS! Realtime is working!');
      process.exit(0);
    } else if (status === 'TIMED_OUT') {
      console.error('❌ TIMEOUT! Realtime is NOT enabled in Supabase.');
      console.error('');
      console.error('To fix:');
      console.error('1. Go to: https://supabase.com/dashboard/project/' + supabaseUrl.split('.')[0].split('//')[1]);
      console.error('2. Click: Project Settings > API');
      console.error('3. Scroll to "Realtime" section');
      console.error('4. Enable "Realtime"');
      console.error('5. Wait 1-2 minutes for changes to apply');
      process.exit(1);
    } else if (status === 'CHANNEL_ERROR') {
      console.error('❌ CHANNEL ERROR! Realtime may not be properly configured.');
      console.error('Error details:', err);
      process.exit(1);
    }
  });

// Timeout after 65 seconds
setTimeout(() => {
  console.error('Test timed out after 65 seconds');
  process.exit(1);
}, 65000);
