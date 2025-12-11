/**
 * Token Refresh API for Long Training Jobs
 * POST /api/training/refresh-token
 *
 * Purpose: Refresh expired access tokens for training server
 * Called by: Python training server (localhost:8000) every 45 minutes
 * Auth: Requires valid user session (even if token expired)
 * Date: 2025-11-05
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[TokenRefresh] CRITICAL: Missing environment variables!');
  console.error('[TokenRefresh] NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('[TokenRefresh] NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'SET' : 'MISSING');
}

export async function POST(request: NextRequest) {
  console.log('[TokenRefresh] Refresh request received');

  // Extract current access token from Authorization header
  const authHeader = request.headers.get('authorization');
  const currentToken = authHeader?.replace('Bearer ', '');

  console.log('[TokenRefresh] Current token present:', !!currentToken);

  if (!currentToken) {
    console.error('[TokenRefresh] Missing authorization token');
    return NextResponse.json(
      { error: 'Unauthorized: Missing access token' },
      { status: 401 }
    );
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials' },
      { status: 500 }
    );
  }

  try {
    // Create authenticated Supabase client using current token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${currentToken}`
        }
      }
    });

    // Verify user is authenticated (validates token is still valid or refreshable)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[TokenRefresh] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized: Token cannot be refreshed', details: authError?.message },
        { status: 401 }
      );
    }

    console.log('[TokenRefresh] User authenticated:', user.id);

    // Get a fresh session using refreshSession()
    const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError || !session) {
      console.error('[TokenRefresh] Refresh failed:', refreshError);

      // If refresh fails, return the current token (it may still be valid)
      console.log('[TokenRefresh] Returning current token as fallback');
      return NextResponse.json({
        access_token: currentToken,
        expires_at: null,
        expires_in: null,
        token_type: 'bearer',
        refreshed: false,
        message: 'Token refresh not available, using current token'
      }, { status: 200 });
    }

    // Successfully refreshed
    console.log('[TokenRefresh] Session refreshed successfully');
    console.log('[TokenRefresh] New token expires at:', new Date(session.expires_at! * 1000).toISOString());

    return NextResponse.json({
      access_token: session.access_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: 'bearer',
      refreshed: true
    }, { status: 200 });

  } catch (error) {
    console.error('[TokenRefresh] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to refresh token',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
