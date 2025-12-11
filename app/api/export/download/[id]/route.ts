/**
 * API Route - Export Download
 *
 * Downloads a generated export file.
 * GET /api/export/download/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exportService } from '@/lib/export';
import { getMimeType } from '@/lib/export/config';
import { readFile, unlink } from 'fs/promises';

// Use Node.js runtime for file system operations
export const runtime = 'nodejs';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    // Create authenticated Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    // Get export ID from params (await in Next.js 15)
    const { id: exportId } = await params;
    if (!exportId) {
      return NextResponse.json(
        { error: 'Missing export ID' },
        { status: 400 }
      );
    }

    console.log('[Download] Retrieving export:', exportId, 'for user:', user.id);

    // Get export info (includes security check via user_id)
    const exportInfo = await exportService.getExport(exportId, user.id);
    if (!exportInfo) {
      return NextResponse.json(
        { error: 'Export not found or access denied' },
        { status: 404 }
      );
    }

    // Read file content
    const fileContent = await readFile(exportInfo.filePath);

    // Track download
    await exportService.trackDownload(exportId);

    console.log('[Download] File sent successfully');

    // Return file with appropriate headers (convert Buffer to Uint8Array for compatibility)
    return new NextResponse(new Blob([new Uint8Array(fileContent)]), {
      status: 200,
      headers: {
        'Content-Type': getMimeType(exportInfo.format),
        'Content-Disposition': `attachment; filename="export_${exportId}.${exportInfo.format}"`,
        'Cache-Control': 'private, no-cache',
      },
    });

  } catch (error) {
    console.error('[Download] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    // Create authenticated Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    // Get export ID from params
    const { id: exportId } = await params;
    if (!exportId) {
      return NextResponse.json(
        { error: 'Missing export ID' },
        { status: 400 }
      );
    }

    console.log('[Delete] Deleting export:', exportId, 'for user:', user.id);

    // Get export info (includes security check)
    const exportInfo = await exportService.getExport(exportId, user.id);
    if (!exportInfo) {
      return NextResponse.json(
        { error: 'Export not found or access denied' },
        { status: 404 }
      );
    }

    // Delete file
    try {
      await unlink(exportInfo.filePath);
    } catch (fileError) {
      console.warn('[Delete] File already deleted:', fileError);
    }

    // Delete database record
    const { error: dbError } = await supabase
      .from('conversation_exports')
      .delete()
      .eq('id', exportId)
      .eq('user_id', user.id);

    if (dbError) {
      throw new Error(`Failed to delete export record: ${dbError.message}`);
    }

    console.log('[Delete] Export deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'Export deleted successfully'
    });

  } catch (error) {
    console.error('[Delete] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
