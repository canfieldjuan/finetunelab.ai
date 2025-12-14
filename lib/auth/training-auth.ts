/**
 * Training Authentication Helper
 * Provides dual auth support (session + API key) for training endpoints
 * Date: 2025-12-13
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateRequestWithScope, extractApiKeyFromHeaders } from './api-key-validator';

const API_KEY_PREFIX = 'wak_';

export type TrainingAuthResult =
  | { ok: true; userId: string; mode: 'session' | 'apiKey'; keyId?: string; authorizationHeader?: string }
  | { ok: false; status: number; error: string };

/**
 * Authenticates a request for training endpoints
 * Supports both session tokens (for UI) and API keys (for SDK)
 *
 * @param req - NextRequest object
 * @returns Authentication result with user ID and mode
 */
export async function authenticateTraining(req: NextRequest): Promise<TrainingAuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Training Auth] Missing Supabase environment variables');
    return { ok: false, status: 500, error: 'Server configuration error' };
  }

  // Check for API key in headers
  const headerApiKey = req.headers.get('x-api-key') || req.headers.get('x-workspace-api-key');
  const authHeader = req.headers.get('authorization');

  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  const bearerValue = bearerMatch?.[1]?.trim() || null;
  const apiKeyInAuthorization = !!(bearerValue && bearerValue.startsWith(API_KEY_PREFIX));

  // Path 1: API Key Authentication
  if (headerApiKey || apiKeyInAuthorization) {
    console.log('[Training Auth] Attempting API key authentication');

    const validation = await validateRequestWithScope(req.headers, 'training');
    if (!validation.isValid || !validation.userId) {
      console.log('[Training Auth] API key validation failed:', validation.errorMessage);
      return {
        ok: false,
        status: validation.scopeError ? 403 : (validation.rateLimitExceeded ? 429 : 401),
        error: validation.errorMessage || 'Unauthorized',
      };
    }

    const extracted = extractApiKeyFromHeaders(req.headers);
    if (!extracted || !extracted.startsWith(API_KEY_PREFIX)) {
      return { ok: false, status: 401, error: 'Invalid API key format' };
    }

    console.log('[Training Auth] API key authentication successful for user:', validation.userId);
    return {
      ok: true,
      userId: validation.userId,
      mode: 'apiKey',
      keyId: validation.keyId
    };
  }

  // Path 2: Session Token Authentication
  if (!authHeader) {
    console.log('[Training Auth] No authorization header provided');
    return { ok: false, status: 401, error: 'Missing authorization header' };
  }

  console.log('[Training Auth] Attempting session authentication');

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.log('[Training Auth] Session authentication failed:', authError?.message);
    return { ok: false, status: 401, error: 'Authentication failed' };
  }

  console.log('[Training Auth] Session authentication successful for user:', user.id);
  return {
    ok: true,
    userId: user.id,
    mode: 'session',
    authorizationHeader: authHeader
  };
}
