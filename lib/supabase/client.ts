/**
 * Supabase Client Wrapper
 *
 * Provides a unified interface for creating Supabase clients.
 * This wrapper allows for consistent client creation across the application.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

/**
 * Create a new Supabase client instance
 * Client-side safe - uses anonymous key and respects RLS
 */
export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}
