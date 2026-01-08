// API routes for User API Key management
// GET /api/user/api-keys - List user's API keys (masked)
// POST /api/user/api-keys - Generate a new API key
// Date: 2025-10-17
// Updated: 2025-12-12 - Added scopes support

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateApiKey } from '@/lib/auth/api-key-generator';
import type { ApiKeyScope } from '@/lib/auth/api-key-validator';

const VALID_SCOPES: ApiKeyScope[] = ['all', 'training', 'production', 'testing', 'worker'];

export const runtime = 'nodejs';

// ============================================================================
// GET /api/user/api-keys - List user's API keys (masked)
// Returns list of user's API keys with sensitive data masked
// ============================================================================

export async function GET(request: NextRequest) {
  console.log('[ApiKeysAPI] GET /api/user/api-keys - Listing API keys');

  try {
    // Require authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.log('[ApiKeysAPI] Unauthorized - no auth header');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user authentication
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[ApiKeysAPI] Auth failed:', authError);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[ApiKeysAPI] Fetching API keys for user:', user.id);

    // Query user_api_keys table
    const { data: apiKeys, error: queryError } = await supabase
      .from('user_api_keys')
      .select('id, name, key_prefix, is_active, request_count, last_used_at, created_at, scopes')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('[ApiKeysAPI] Query error:', queryError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch API keys',
          details: queryError.message,
        },
        { status: 500 }
      );
    }

    console.log('[ApiKeysAPI] Returning', apiKeys?.length || 0, 'API keys');
    return NextResponse.json({
      success: true,
      apiKeys: apiKeys || [],
      count: apiKeys?.length || 0,
    });

  } catch (error) {
    console.error('[ApiKeysAPI] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list API keys',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/user/api-keys - Generate a new API key
// Requires authentication, creates and returns a new API key
// ============================================================================

export async function POST(request: NextRequest) {
  console.log('[ApiKeysAPI] POST /api/user/api-keys - Creating API key');

  try {
    // Require authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.log('[ApiKeysAPI] Unauthorized - no auth header');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user authentication
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[ApiKeysAPI] Auth failed:', authError);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();

    if (!body.name) {
      console.log('[ApiKeysAPI] Missing required field: name');
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field',
          required: ['name'],
        },
        { status: 400 }
      );
    }

    // Validate scopes if provided
    let scopes: ApiKeyScope[] = body.scopes || ['all'];

    // If empty array, default to 'all'
    if (scopes.length === 0) {
      scopes = ['all'];
    }

    // Validate each scope
    const invalidScopes = scopes.filter((s: string) => !VALID_SCOPES.includes(s as ApiKeyScope));
    if (invalidScopes.length > 0) {
      console.log('[ApiKeysAPI] Invalid scopes:', invalidScopes);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid scopes provided',
          invalidScopes,
          validScopes: VALID_SCOPES,
        },
        { status: 400 }
      );
    }

    console.log('[ApiKeysAPI] Generating API key:', body.name, 'for user:', user.id, 'scopes:', scopes);

    // Generate API key
    const { key, keyHash, keyPrefix } = generateApiKey();

    // Insert into database
    const { data: newKey, error: insertError } = await supabase
      .from('user_api_keys')
      .insert({
        user_id: user.id,
        name: body.name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        is_active: true,
        scopes: scopes,
      })
      .select('id, name, key_prefix, is_active, created_at, scopes')
      .single();

    if (insertError) {
      console.error('[ApiKeysAPI] Insert error:', insertError);
      
      // Check for duplicate name
      if (insertError.code === '23505') {
        return NextResponse.json(
          {
            success: false,
            error: 'API key with this name already exists',
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create API key',
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    console.log('[ApiKeysAPI] API key created successfully:', newKey?.id);
    return NextResponse.json({
      success: true,
      apiKey: {
        ...newKey,
        key, // Full key only returned once
      },
      message: 'API key created successfully. Save this key - it will not be shown again.',
    }, { status: 201 });

  } catch (error) {
    console.error('[ApiKeysAPI] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create API key',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
