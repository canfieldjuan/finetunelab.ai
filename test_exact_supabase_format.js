import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const url = 'wss://tkizlemssfmrfluychsn.supabase.co/realtime/v1/websocket';
const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Test with the EXACT params that supabase-js would use
const wsUrl = `${url}?apikey=${apiKey}&vsn=1.0.0`;

console.log('Connecting to:', wsUrl.substring(0, 100) + '...\n');

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✅ WebSocket opened\n');
  
  // Send the EXACT join message that supabase-js sends
  const joinMessage = {
    topic: 'realtime:test-exact-match',
    event: 'phx_join',
    payload: {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: '', enabled: false },
        postgres_changes: [],
        private: false
      }
    },
    ref: '1'
  };
  
  console.log('Sending join (exact supabase-js format):', JSON.stringify(joinMessage, null, 2), '\n');
  ws.send(JSON.stringify(joinMessage));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('Received:', JSON.stringify(msg, null, 2), '\n');
  
  if (msg.event === 'phx_reply') {
    if (msg.payload.status === 'ok') {
      console.log('✅ Got phx_reply with status ok!');
      console.log('This proves the message format is correct.\n');
      console.log('The issue must be in how supabase-js handles the WebSocket connection itself.\n');
      ws.close();
      process.exit(0);
    } else {
      console.error('❌ Join rejected:', msg.payload);
      ws.close();
      process.exit(1);
    }
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
  process.exit(1);
});

setTimeout(() => {
  console.error('⏱️  Timeout\n');
  ws.close();
  process.exit(1);
}, 15000);
