// API route for deleting/revoking a specific API key
// DELETE /api/user/api-keys/[id] - Revoke an API key
// Date: 2025-10-17

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// ============================================================================
// DELETE /api/user/api-keys/[id] - Revoke an API key
// Marks the API key as inactive (soft delete)
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[ApiKeysAPI] DELETE /api/user/api-keys/' + id + ' - Revoking API key');

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

    console.log('[ApiKeysAPI] Revoking API key:', id, 'for user:', user.id);

    // Update is_active to false (soft delete)
    const { data: revokedKey, error: updateError } = await supabase
      .from('user_api_keys')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, name')
      .single();

    if (updateError) {
      console.error('[ApiKeysAPI] Update error:', updateError);
      
      // Check if key not found
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          {
            success: false,
            error: 'API key not found',
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to revoke API key',
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    console.log('[ApiKeysAPI] API key revoked successfully:', revokedKey?.id);
    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully',
      apiKey: revokedKey,
    });

  } catch (error) {
    console.error('[ApiKeysAPI] DELETE error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to revoke API key',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
