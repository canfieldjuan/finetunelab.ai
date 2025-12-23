import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Using placeholders for build.');
}

const url = supabaseUrl || 'https://placeholder.supabase.co';
const key = supabaseAnonKey || 'placeholder';

// Client for user-facing operations (respects RLS)
export const supabase = createClient(url, key, {
  realtime: {
    timeout: 30000, // 30 seconds timeout for slow connections
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'x-application-name': 'five5-training-monitor'
    }
  }
});

// Service role client for server-side operations (bypasses RLS)
// Used for: model config lookup at runtime, system operations
export const supabaseAdmin = supabaseServiceKey
  ? createClient(url, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;
