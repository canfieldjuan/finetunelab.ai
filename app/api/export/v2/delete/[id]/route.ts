/**
 * Unified Export Delete API - v2
 * Phase 4: API Migration
 *
 * DELETE /api/export/v2/delete/[id] - Delete export
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getUnifiedExportService,
  FilesystemStorage,
} from '@/lib/export-unified';
import { unifiedExportConfig } from '@/lib/export-unified';

/**
 * Initialize storage provider
 */
function initializeStorage() {
  const storage = new FilesystemStorage(unifiedExportConfig.storagePath);
  storage.initialize().catch((err) => {
    console.error('[Delete API] Failed to initialize storage:', err);
  });
  return storage;
}

/**
 * DELETE /api/export/v2/delete/[id]
 * Delete an export
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create authenticated Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const exportId = params.id;

    console.log('[Delete API] Deleting export:', {
      exportId,
      userId: user.id,
    });

    // Get export info (this validates ownership via RLS)
    const service = getUnifiedExportService();
    const exportInfo = await service.getExportInfo(exportId, user.id);

    if (!exportInfo) {
      return NextResponse.json({ error: 'Export not found' }, { status: 404 });
    }

    // Delete file from storage
    const storage = initializeStorage();
    try {
      await storage.deleteExport(exportInfo.filePath);
      console.log('[Delete API] File deleted from storage:', exportInfo.filePath);
    } catch (storageError) {
      console.error('[Delete API] Error deleting file from storage:', storageError);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('unified_exports')
      .delete()
      .eq('id', exportId)
      .eq('user_id', user.id);

    if (dbError) {
      console.error('[Delete API] Database error:', dbError);
      return NextResponse.json(
        { error: `Failed to delete export: ${dbError.message}` },
        { status: 500 }
      );
    }

    console.log('[Delete API] Export deleted successfully:', exportId);

    return NextResponse.json({
      success: true,
      message: 'Export deleted successfully',
    });
  } catch (error) {
    console.error('[Delete API] Error deleting export:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
