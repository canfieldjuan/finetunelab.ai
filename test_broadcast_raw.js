import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const url = 'wss://tkizlemssfmrfluychsn.supabase.co/realtime/v1/websocket';
const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing WebSocket subscription with detailed logging...\n');

const ws = new WebSocket(`${url}?apikey=${apiKey}&vsn=1.0.0`);

let messageCount = 0;

ws.on('open', () => {
  console.log('WebSocket OPENED!\n');
  
  // Send join for broadcast channel
  const joinMessage = {
    topic: 'realtime:test-broadcast',
    event: 'phx_join',
    payload: {
      config: {
        broadcast: { self: true }
      }
    },
    ref: '1'
  };
  
  console.log('Sending join message:', JSON.stringify(joinMessage, null, 2), '\n');
  ws.send(JSON.stringify(joinMessage));
});

ws.on('message', (data) => {
  messageCount++;
  const msg = JSON.parse(data.toString());
  
  console.log(`\n[Message ${messageCount}] Received:`, JSON.stringify(msg, null, 2));
  
  if (msg.event === 'phx_reply' && msg.ref === '1') {
    if (msg.payload.status === 'ok') {
      console.log('\n✅ Channel join accepted!');
      console.log('Response:', msg.payload.response);
      
      // Try sending a broadcast
      const broadcastMessage = {
        topic: 'realtime:test-broadcast',
        event: 'broadcast',
        payload: {
          type: 'broadcast',
          event: 'test',
          payload: { message: 'Hello!' }
        },
        ref: '2'
      };
      
      console.log('\nSending broadcast:', JSON.stringify(broadcastMessage, null, 2));
      ws.send(JSON.stringify(broadcastMessage));
      
      setTimeout(() => {
        console.log('\n✅ Broadcast test complete. Closing connection.');
        ws.close();
        process.exit(0);
      }, 3000);
    } else {
      console.error('\n❌ Channel join rejected!');
      console.error('Status:', msg.payload.status);
      console.error('Response:', msg.payload.response);
      ws.close();
      process.exit(1);
    }
  }
});

ws.on('error', (error) => {
  console.error('WebSocket ERROR:', error);
});

ws.on('close', () => {
  console.log('\nWebSocket CLOSED');
});

setTimeout(() => {
  console.error('\n⏱️  Timeout after 15 seconds');
  ws.close();
  process.exit(1);
}, 15000);
