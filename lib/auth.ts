// Authentication Utilities
// Purpose: Helper functions for Supabase authentication
// Date: 2025-10-17

import { supabase } from '@/lib/supabaseClient';

/**
 * Get the current authenticated session token
 * @returns Promise<string> - The access token
 * @throws Error if not authenticated
 */
export async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated. Please log in.');
  }

  return session.access_token;
}

/**
 * Get authenticated fetch headers with Authorization
 * @returns Promise<HeadersInit> - Headers object with auth token
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();
  return {
    'Authorization': `Bearer ${token}`,
  };
}
