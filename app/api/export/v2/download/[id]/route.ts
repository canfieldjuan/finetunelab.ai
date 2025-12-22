/**
 * Unified Export Download API - v2
 * Phase 4: API Migration
 *
 * GET /api/export/v2/download/[id] - Download export file
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getUnifiedExportService,
  FilesystemStorage,
} from '@/lib/export-unified';
import { unifiedExportConfig, MIME_TYPES } from '@/lib/export-unified';

/**
 * Initialize storage provider
 */
function initializeStorage() {
  const storage = new FilesystemStorage(unifiedExportConfig.storagePath);
  storage.initialize().catch((err) => {
    console.error('[Download API] Failed to initialize storage:', err);
  });
  return storage;
}

/**
 * GET /api/export/v2/download/[id]
 * Download export file
 */
export async function GET(
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

    console.log('[Download API] Downloading export:', {
      exportId,
      userId: user.id,
    });

    // Get export info
    const service = getUnifiedExportService();
    const exportInfo = await service.getExportInfo(exportId, user.id);

    if (!exportInfo) {
      // Try fallback to old export tables (backward compatibility)
      console.log('[Download API] Export not found in unified table, checking legacy tables');

      // Check old conversation_exports table
      const { data: oldConvExport } = await supabase
        .from('conversation_exports')
        .select('*')
        .eq('id', exportId)
        .eq('user_id', user.id)
        .single();

      if (oldConvExport) {
        console.log('[Download API] Found in conversation_exports (legacy)');
        // Serve from old location
        // This is a simplified fallback - in production, we'd read from the old file path
        return NextResponse.json(
          { error: 'Legacy export - please regenerate' },
          { status: 410 } // Gone
        );
      }

      // Check old analytics_exports table
      const { data: oldAnalyticsExport } = await supabase
        .from('analytics_exports')
        .select('*')
        .eq('id', exportId)
        .eq('user_id', user.id)
        .single();

      if (oldAnalyticsExport) {
        console.log('[Download API] Found in analytics_exports (legacy)');
        return NextResponse.json(
          { error: 'Legacy export - please regenerate' },
          { status: 410 } // Gone
        );
      }

      return NextResponse.json({ error: 'Export not found' }, { status: 404 });
    }

    // Check if expired
    const now = new Date();
    if (now > exportInfo.expiresAt) {
      return NextResponse.json({ error: 'Export has expired' }, { status: 410 });
    }

    // Check status
    if (exportInfo.status === 'pending' || exportInfo.status === 'processing') {
      return NextResponse.json(
        {
          error: `Export is still ${exportInfo.status}`,
          status: exportInfo.status,
        },
        { status: 202 } // Accepted but not ready
      );
    }

    if (exportInfo.status === 'failed') {
      return NextResponse.json(
        { error: 'Export generation failed' },
        { status: 500 }
      );
    }

    if (exportInfo.status === 'expired') {
      return NextResponse.json({ error: 'Export has expired' }, { status: 410 });
    }

    // Get file from storage
    const storage = initializeStorage();
    const fileContent = await storage.getExport(exportInfo.filePath);

    // Increment download count
    await service.incrementDownloadCount(exportId, user.id);

    console.log('[Download API] Export downloaded:', {
      exportId,
      fileName: exportInfo.fileName,
      fileSize: exportInfo.fileSize,
      downloadCount: exportInfo.downloadCount + 1,
    });

    // Get MIME type
    const mimeType = MIME_TYPES[exportInfo.format] || 'application/octet-stream';

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(fileContent);

    // Return file as response
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${exportInfo.fileName}"`,
        'Content-Length': exportInfo.fileSize.toString(),
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
        'X-Export-ID': exportId,
        'X-Export-Type': exportInfo.exportType,
        'X-Export-Format': exportInfo.format,
      },
    });
  } catch (error) {
    console.error('[Download API] Error downloading export:', error);

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
