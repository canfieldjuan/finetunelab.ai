// GitHub Token Helper
// Purpose: Retrieve GitHub token from multiple sources (vault, OAuth, server)
// Date: 2025-10-22
// Updated: 2025-10-22 - Added secrets vault lookup

import { createClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/models/encryption';

/**
 * Get GitHub token from multiple sources (in order of priority):
 * 1. User's secrets vault (provider_secrets table)
 * 2. GitHub OAuth provider_token (if signed in with GitHub)
 * 3. Returns null (caller will use server GITHUB_TOKEN as fallback)
 *
 * @param authHeader - Authorization header from request (Bearer token)
 * @returns GitHub token or null if not available
 */
export async function getUserGithubToken(authHeader: string): Promise<string | null> {
  console.log('[GitHubTokenHelper] Retrieving GitHub token (checking vault -> OAuth -> fallback)');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[GitHubTokenHelper] Missing Supabase configuration');
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Get the authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.warn('[GitHubTokenHelper] No user found:', userError?.message);
    return null;
  }

  console.log('[GitHubTokenHelper] User found:', user.email);

  // PRIORITY 1: Check secrets vault for GitHub token
  console.log('[GitHubTokenHelper] Checking secrets vault for GitHub token');
  const { data: vaultSecret, error: vaultError } = await supabase
    .from('provider_secrets')
    .select('api_key_encrypted')
    .eq('user_id', user.id)
    .eq('provider', 'github')
    .single();

  if (vaultSecret && vaultSecret.api_key_encrypted) {
    try {
      const decryptedToken = decrypt(vaultSecret.api_key_encrypted);
      console.log('[GitHubTokenHelper] Using GitHub token from secrets vault');
      return decryptedToken;
    } catch (decryptError) {
      console.error('[GitHubTokenHelper] Failed to decrypt vault token:', decryptError);
      // Continue to OAuth check
    }
  } else if (vaultError && vaultError.code !== 'PGRST116') {
    // PGRST116 = no rows returned (expected if user hasn't added token)
    console.warn('[GitHubTokenHelper] Vault lookup error:', vaultError.message);
  } else {
    console.log('[GitHubTokenHelper] No GitHub token in vault');
  }

  // PRIORITY 2: Check OAuth provider token (if signed in with GitHub)
  console.log('[GitHubTokenHelper] Checking OAuth provider token');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.warn('[GitHubTokenHelper] No session found:', sessionError?.message);
    return null;
  }

  // Check if user signed in with GitHub provider
  const provider = sessionData.session.user.app_metadata?.provider;

  if (provider !== 'github') {
    console.log('[GitHubTokenHelper] User did not sign in with GitHub (provider:', provider, ')');
    console.log('[GitHubTokenHelper] No GitHub token available - user should add to vault or use GitHub OAuth');
    return null;
  }

  // Extract GitHub provider token
  const providerToken = sessionData.session.provider_token;

  if (!providerToken) {
    console.warn('[GitHubTokenHelper] No provider token found for GitHub user');
    console.warn('[GitHubTokenHelper] User may need to re-authenticate with gist scope');
    return null;
  }

  console.log('[GitHubTokenHelper] Using GitHub token from OAuth provider');
  return providerToken;
}

console.log('[GitHubTokenHelper] GitHub token helper utility loaded');
