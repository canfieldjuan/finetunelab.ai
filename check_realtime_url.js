import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Anon Key (first 20 chars):', anonKey?.substring(0, 20));

// The realtime endpoint should be constructed from the supabase URL
const expectedRealtimeUrl = supabaseUrl?.replace('https://', 'wss://').replace('http://', 'ws://') + '/realtime/v1/websocket';

console.log('\nExpected Realtime WebSocket URL:', expectedRealtimeUrl);
console.log('\nThis is what supabase-js should be connecting to.');
console.log('\nRaw WebSocket test connected to: wss://tkizlemssfmrfluychsn.supabase.co/realtime/v1/websocket');
console.log('\nDo these match?', expectedRealtimeUrl === 'wss://tkizlemssfmrfluychsn.supabase.co/realtime/v1/websocket');
