/**
 * Server-Side Supabase Client
 *
 * Creates a Supabase client with service role privileges for server-side operations.
 * This client bypasses RLS policies and should ONLY be used in API routes and server-side code.
 *
 * WARNING: Never expose this client to the browser!
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Use placeholder values during build when env vars aren't available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY0NTE5MjgyMCwiZXhwIjoxOTYwNzY4ODIwfQ.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

/**
 * Create a Supabase client with service role privileges
 * Server-side only - bypasses RLS for administrative operations
 */
export function createServerClient() {
  return createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
