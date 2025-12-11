import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const wsUrl = supabaseUrl.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + anonKey + '&vsn=1.0.0';

console.log('Testing raw WebSocket connection to Realtime...\n');
console.log('URL:', wsUrl.replace(anonKey, 'ANON_KEY'));
console.log('');

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✅ WebSocket OPENED!');
  console.log('');
  console.log('Sending join message...');
  
  // Send Phoenix channel join message
  const joinMsg = JSON.stringify({
    topic: 'realtime:public',
    event: 'phx_join',
    payload: {},
    ref: '1'
  });
  
  ws.send(joinMsg);
});

ws.on('message', (data) => {
  console.log('📨 Received message:', data.toString());
  const msg = JSON.parse(data.toString());
  
  if (msg.event === 'phx_reply' && msg.payload?.status === 'ok') {
    console.log('');
    console.log('🎉 SUCCESS! Realtime WebSocket is working!');
    console.log('');
    console.log('The WebSocket connection and Phoenix protocol work.');
    console.log('This means Realtime infrastructure IS enabled.');
    console.log('');
    console.log('The issue must be with:');
    console.log('1. The postgres_changes subscription specifically');
    console.log('2. Or the supabase-js client library configuration');
    console.log('');
    ws.close();
    process.exit(0);
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket ERROR:', err.message);
  console.error('');
  console.error('This means Realtime is NOT accessible at the network level.');
  console.error('Possible causes:');
  console.error('1. Realtime feature is disabled in Supabase project');
  console.error('2. Firewall or network blocking WebSocket connections');
  console.error('3. Project is paused or has issues');
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log('WebSocket closed:', code, reason.toString());
  if (code !== 1000) {
    console.error('');
    console.error('❌ WebSocket closed unexpectedly');
    console.error('This suggests Realtime rejected the connection');
    process.exit(1);
  }
});

setTimeout(() => {
  console.error('');
  console.error('⏱️  Timeout after 10 seconds');
  console.error('WebSocket never opened - Realtime is not responding');
  ws.close();
  process.exit(1);
}, 10000);
