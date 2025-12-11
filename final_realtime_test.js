import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 DEFINITIVE REALTIME DIAGNOSIS\n');
console.log('='.repeat(80));

async function runAllTests() {
  // Test 1: Simple channel (no postgres_changes)
  console.log('\n📡 TEST 1: Basic channel subscription (no table)');
  console.log('This tests if Realtime WebSocket works at all...\n');
  
  const client1 = createClient(supabaseUrl, anonKey, {
    realtime: { timeout: 15000 }
  });
  
  const basicChannel = client1.channel('test-basic-channel');
  
  await new Promise((resolve) => {
    basicChannel.subscribe((status) => {
      console.log('   Basic channel status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('   ✅ Basic channel works - WebSocket is functional!\n');
        basicChannel.unsubscribe();
        resolve(true);
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        console.log('   ❌ Basic channel failed - Realtime is NOT enabled!\n');
        basicChannel.unsubscribe();
        resolve(false);
      }
    });
    
    setTimeout(() => {
      console.log('   ⏱️  Basic channel timed out\n');
      basicChannel.unsubscribe();
      resolve(false);
    }, 16000);
  });
  
  // Test 2: Table subscription with anon key
  console.log('📊 TEST 2: Table subscription with ANON key');
  console.log('This tests if we can subscribe to training tables...\n');
  
  const client2 = createClient(supabaseUrl, anonKey, {
    realtime: { timeout: 15000 }
  });
  
  const tableChannel = client2
    .channel('test-table-channel')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'local_training_jobs'
    }, (payload) => {
      console.log('   Received event:', payload);
    });
  
  await new Promise((resolve) => {
    tableChannel.subscribe((status) => {
      console.log('   Table channel status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('   ✅ Table subscription works with anon key!\n');
        tableChannel.unsubscribe();
        resolve(true);
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        console.log('   ❌ Table subscription failed with anon key\n');
        tableChannel.unsubscribe();
        resolve(false);
      }
    });
    
    setTimeout(() => {
      console.log('   ⏱️  Table channel timed out\n');
      tableChannel.unsubscribe();
      resolve(false);
    }, 16000);
  });
  
  // Test 3: Table subscription with service role
  console.log('🔑 TEST 3: Table subscription with SERVICE ROLE');
  console.log('This bypasses ALL RLS - if this fails, Realtime is disabled...\n');
  
  const client3 = createClient(supabaseUrl, serviceKey, {
    realtime: { timeout: 15000 }
  });
  
  const serviceChannel = client3
    .channel('test-service-channel')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'local_training_jobs'
    }, (payload) => {
      console.log('   Received event:', payload);
    });
  
  const result = await new Promise((resolve) => {
    serviceChannel.subscribe((status) => {
      console.log('   Service role status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('   ✅ Service role works - Everything is configured!\n');
        serviceChannel.unsubscribe();
        resolve('success');
      } else if (status === 'TIMED_OUT') {
        console.log('   ❌ Service role TIMED OUT\n');
        serviceChannel.unsubscribe();
        resolve('timeout');
      } else if (status === 'CHANNEL_ERROR') {
        console.log('   ❌ Service role CHANNEL ERROR\n');
        serviceChannel.unsubscribe();
        resolve('error');
      }
    });
    
    setTimeout(() => {
      console.log('   ⏱️  Service role test timed out\n');
      serviceChannel.unsubscribe();
      resolve('timeout');
    }, 16000);
  });
  
  // Final diagnosis
  console.log('='.repeat(80));
  console.log('📋 FINAL DIAGNOSIS');
  console.log('='.repeat(80));
  console.log('');
  
  if (result === 'success') {
    console.log('🎉 REALTIME IS WORKING!');
    console.log('');
    console.log('Your training dashboard should work now.');
    console.log('Refresh the page and start/continue training.');
  } else if (result === 'timeout') {
    console.log('❌ REALTIME IS NOT ENABLED');
    console.log('');
    console.log('Even service role (which bypasses ALL security) times out.');
    console.log('This definitively proves Realtime is disabled at project level.');
    console.log('');
    console.log('🔧 TO FIX:');
    console.log('1. Open: https://supabase.com/dashboard/project/tkizlemssfmrfluychsn/settings/api');
    console.log('2. Scroll down to "Realtime" section');
    console.log('3. Toggle "Enable Realtime" to ON');
    console.log('4. Click "Save" if there\'s a save button');
    console.log('5. Wait 2-3 minutes for infrastructure to restart');
    console.log('6. Run this test again');
  } else {
    console.log('⚠️  CHANNEL ERROR');
    console.log('');
    console.log('There may be a network issue or Realtime configuration problem.');
    console.log('Check Supabase Dashboard for any error messages.');
  }
  console.log('');
  
  process.exit(result === 'success' ? 0 : 1);
}

runAllTests();
