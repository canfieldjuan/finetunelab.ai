/**
 * Widget App API - Individual App Operations
 * 
 * DELETE - Delete a specific widget app
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * DELETE /api/widget-apps/[id]
 * Delete a widget app (and all associated data via CASCADE)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[Widget App API] DELETE request for:', id);

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
      console.error('[Widget App API] Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify ownership
    const { data: app, error: fetchError } = await supabase
      .from('widget_apps')
      .select('id, user_id, name')
      .eq('id', id)
      .single();

    if (fetchError || !app) {
      console.error('[Widget App API] App not found:', fetchError);
      return NextResponse.json(
        { error: 'Widget app not found' },
        { status: 404 }
      );
    }

    if (app.user_id !== user.id) {
      console.error('[Widget App API] Unauthorized access attempt');
      return NextResponse.json(
        { error: 'You do not own this widget app' },
        { status: 403 }
      );
    }

    console.log('[Widget App API] Deleting app:', app.name);

    // Delete app (CASCADE will delete sessions and events)
    const { error: deleteError } = await supabase
      .from('widget_apps')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Widget App API] Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete widget app' },
        { status: 500 }
      );
    }

    console.log('[Widget App API] App deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'Widget app deleted successfully',
    });

  } catch (error) {
    console.error('[Widget App API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
