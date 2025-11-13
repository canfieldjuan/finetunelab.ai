/**
 * Widget Apps API
 * 
 * Manage widget applications for LLMOps tracking
 * GET - List user's widget apps
 * POST - Create new widget app
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/widget-apps
 * List all widget apps for authenticated user
 */
export async function GET(request: NextRequest) {
  console.log('[Widget Apps API] GET request');

  try {
    // Get auth token from header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify user with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[Widget Apps API] Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Widget Apps API] Fetching apps for user:', user.id);

    // Fetch user's widget apps
    const { data: apps, error: fetchError } = await supabase
      .from('widget_apps')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('[Widget Apps API] Fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch widget apps' },
        { status: 500 }
      );
    }

    console.log('[Widget Apps API] Found', apps?.length || 0, 'apps');

    return NextResponse.json({
      success: true,
      count: apps?.length || 0,
      apps: apps || [],
    });

  } catch (error) {
    console.error('[Widget Apps API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/widget-apps
 * Create new widget app
 */
export async function POST(request: NextRequest) {
  console.log('[Widget Apps API] POST request');

  try {
    // Get auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[Widget Apps API] Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, description, allowed_origins } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'App name is required' },
        { status: 400 }
      );
    }

    console.log('[Widget Apps API] Creating app:', name);

    // Generate app ID and token
    const appId = `app_${nanoid(16)}`;
    const appToken = `widget_${nanoid(32)}`;
    
    // Hash the token (simple SHA-256)
    const tokenHash = await hashToken(appToken);
    const tokenPrefix = appToken.substring(0, 12);

    // Create widget app
    const { data: app, error: insertError } = await supabase
      .from('widget_apps')
      .insert({
        id: appId,
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        allowed_origins: allowed_origins || [],
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Widget Apps API] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create widget app' },
        { status: 500 }
      );
    }

    console.log('[Widget Apps API] App created:', appId);

    return NextResponse.json({
      success: true,
      app: {
        id: app.id,
        token: appToken, // Only returned once!
        name: app.name,
        description: app.description,
        allowed_origins: app.allowed_origins,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('[Widget Apps API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Hash token for secure storage
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
