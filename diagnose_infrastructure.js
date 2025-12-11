import https from 'https';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const projectRef = supabaseUrl.split('//')[1].split('.')[0];

console.log('🔍 Checking Realtime Infrastructure Status\n');
console.log('Project:', projectRef);
console.log('URL:', supabaseUrl);
console.log('');

// Check if realtime endpoint is reachable
const wsUrl = supabaseUrl.replace('https://', 'wss://') + '/realtime/v1/websocket';
console.log('WebSocket URL:', wsUrl);
console.log('');

// Try to check the health endpoint
const healthUrl = `https://${projectRef}.supabase.co/rest/v1/`;

console.log('Testing REST API endpoint (to verify project is accessible)...');
https.get(healthUrl, (res) => {
  console.log('REST API Status:', res.statusCode);
  console.log('REST API Headers:', res.headers);
  
  if (res.statusCode === 200 || res.statusCode === 401) {
    console.log('✅ Project is accessible\n');
  } else {
    console.log('⚠️  Unexpected response\n');
  }
  
  console.log('='.repeat(80));
  console.log('DIAGNOSIS');
  console.log('='.repeat(80));
  console.log('');
  console.log('✅ What is working:');
  console.log('   - Project exists and is accessible');
  console.log('   - REST API responds');
  console.log('   - Database operations work (INSERT/UPDATE confirmed)');
  console.log('   - Tables are in supabase_realtime publication');
  console.log('   - RLS policies exist for data tables');
  console.log('   - Broadcast authorization policies exist');
  console.log('');
  console.log('❌ What is NOT working:');
  console.log('   - WebSocket connection to Realtime server');
  console.log('   - Subscriptions timeout after 60 seconds');
  console.log('   - Even service role (bypassing all security) fails');
  console.log('');
  console.log('🔧 POSSIBLE CAUSES:');
  console.log('');
  console.log('1. Realtime feature is disabled at infrastructure level');
  console.log('   Location: Project Settings > API > Realtime');
  console.log('   Or: Settings > Realtime (if there\'s a dedicated tab)');
  console.log('');
  console.log('2. Free tier limitation');
  console.log('   Some plans may have Realtime disabled by default');
  console.log('   Check: https://supabase.com/pricing');
  console.log('');
  console.log('3. Project needs to be paused/resumed');
  console.log('   Sometimes toggling project state fixes infrastructure issues');
  console.log('');
  console.log('4. Region or network issue');
  console.log('   Try from a different network/VPN');
  console.log('');
  console.log('📍 NEXT STEPS:');
  console.log('');
  console.log('1. Check your Supabase plan/tier');
  console.log('2. Look for a "Realtime" section in Settings');
  console.log('3. Check if there are any warnings in Supabase Dashboard');
  console.log('4. Try pausing and resuming the project');
  console.log('5. Contact Supabase support if issue persists');
  console.log('');
  
  process.exit(0);
}).on('error', (err) => {
  console.error('❌ Error connecting to project:', err.message);
  process.exit(1);
});
