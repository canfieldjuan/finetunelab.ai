/**
 * Server-Side Supabase Client
 *
 * Creates a Supabase client with service role privileges for server-side operations.
 * This client bypasses RLS policies and should ONLY be used in API routes and server-side code.
 *
 * WARNING: Never expose this client to the browser!
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

/**
 * Create a Supabase client with service role privileges
 * Server-side only - bypasses RLS for administrative operations
 */
export function createServerClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase service role environment variables');
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
