/**
 * Supabase Client Wrapper
 *
 * Provides a unified interface for creating Supabase clients.
 * This wrapper allows for consistent client creation across the application.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Use placeholder values during build when env vars aren't available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

/**
 * Create a new Supabase client instance
 * Client-side safe - uses anonymous key and respects RLS
 */
export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}
