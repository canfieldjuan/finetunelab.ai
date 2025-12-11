import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const useServiceRole = process.env.USE_SERVICE_ROLE === 'true';
const anonKey = useServiceRole
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error('Missing Supabase URL or key for realtime probe');
  process.exit(1);
}

console.log('[RealtimeProbe] Using project:', supabaseUrl);
console.log('[RealtimeProbe] Authentication mode:', useServiceRole ? 'service_role' : 'anon');

const client = createClient(supabaseUrl, anonKey, {
  realtime: {
    timeout: 30000,
    params: {
      eventsPerSecond: 5,
    },
    heartbeatIntervalMs: 5000,
  },
});

const logStatus = (label) => (status, err) => {
  console.log(`[RealtimeProbe] ${label} status:`, status, err ?? '');
  if (status === 'SUBSCRIBED') {
    console.log('[RealtimeProbe] ✅ Subscription succeeded');
    setTimeout(async () => {
      await channel.unsubscribe();
      await client.removeChannel(channel);
      console.log('[RealtimeProbe] Channel cleaned up, exiting');
      process.exit(0);
    }, 2000);
  }
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
    console.error('[RealtimeProbe] ❌ Connection failed:', status, err);
    setTimeout(() => process.exit(1), 1000);
  }
};

const channel = client
  .channel('probe')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'local_training_jobs', filter: 'user_id=eq.00000000-0000-0000-0000-000000000000' },
    () => {}
  )
  .subscribe(logStatus('jobs'));

setTimeout(() => {
  console.error('[RealtimeProbe] ❌ Timed out waiting for SUBSCRIBED status');
  process.exit(2);
}, 35000);
