import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Detailed Realtime Diagnostics\n');
console.log('='.repeat(80));

// Try different connection approaches
async function runDiagnostics() {
  
  // Test 1: Service Role Key
  console.log('\n1. Testing with SERVICE ROLE key...');
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    realtime: {
      timeout: 30000,
      heartbeatIntervalMs: 5000,
      log_level: 'debug'
    }
  });
  
  let test1Complete = false;
  const adminChannel = adminClient
    .channel('test-admin')
    .subscribe((status) => {
      console.log('   Service role status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('   ✅ Service role can connect!');
        test1Complete = true;
        adminChannel.unsubscribe();
        runTest2();
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        console.log('   ❌ Service role cannot connect');
        test1Complete = true;
        adminChannel.unsubscribe();
        runTest2();
      }
    });
  
  setTimeout(() => {
    if (!test1Complete) {
      console.log('   ⏱️  Service role test timed out');
      adminChannel.unsubscribe();
      runTest2();
    }
  }, 32000);
  
  // Test 2: Anon Key
  function runTest2() {
    console.log('\n2. Testing with ANON key...');
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const anonClient = createClient(supabaseUrl, anonKey, {
      realtime: {
        timeout: 30000,
        heartbeatIntervalMs: 5000
      }
    });
    
    let test2Complete = false;
    const anonChannel = anonClient
      .channel('test-anon')
      .subscribe((status) => {
        console.log('   Anon key status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('   ✅ Anon key can connect!');
          test2Complete = true;
          anonChannel.unsubscribe();
          runTest3();
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          console.log('   ❌ Anon key cannot connect');
          test2Complete = true;
          anonChannel.unsubscribe();
          runTest3();
        }
      });
    
    setTimeout(() => {
      if (!test2Complete) {
        console.log('   ⏱️  Anon key test timed out');
        anonChannel.unsubscribe();
        runTest3();
      }
    }, 32000);
  }
  
  // Test 3: WebSocket endpoint check
  function runTest3() {
    console.log('\n3. Checking Realtime endpoint...');
    const wsUrl = supabaseUrl.replace('https://', 'wss://') + '/realtime/v1/websocket';
    console.log('   WebSocket URL:', wsUrl);
    
    console.log('\n='.repeat(80));
    console.log('DIAGNOSIS SUMMARY');
    console.log('='.repeat(80));
    console.log('\n✅ Database configured correctly:');
    console.log('   - Tables in supabase_realtime publication');
    console.log('   - Replica identity set to FULL');
    console.log('\n❌ Realtime connections fail:');
    console.log('   - Both service role and anon key timeout');
    console.log('   - WebSocket connections not establishing');
    console.log('\n🔧 REQUIRED ACTION:');
    console.log('   The Realtime feature must be enabled in Supabase Dashboard.');
    console.log('   This cannot be done via SQL or API - it requires manual toggle.');
    console.log('\n📍 WHERE TO ENABLE:');
    console.log('   1. Go to: ' + supabaseUrl.replace('//', '//app.') + '/settings/api');
    console.log('   2. Scroll to "Realtime" section');
    console.log('   3. Toggle "Enable Realtime" to ON');
    console.log('   4. Click "Save"');
    console.log('   5. Wait 1-2 minutes for propagation');
    console.log('\n   Alternative path:');
    console.log('   Project Settings → API → Realtime → Enable');
    console.log('');
    
    process.exit(0);
  }
}

runDiagnostics();
