/**
 * Analytics Download API
 * GET /api/analytics/download/[id]
 * 
 * Download a previously generated export file
 * Phase 3: Backend API Endpoints
 * Date: October 25, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readExportFile } from '@/lib/analytics/export/storage';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

/**
 * Authenticate user
 */
async function authenticateUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return { error: 'Unauthorized - no auth header', user: null };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: 'Unauthorized - invalid token', user: null };
  }

  return { error: null, user };
}

/**
 * Get export record from database
 */
async function getExportRecord(exportId: string, userId: string) {
  console.log('[Analytics Download API] Getting export:', exportId);

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabase
    .from('analytics_exports')
    .select('*')
    .eq('id', exportId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('[Analytics Download API] Export not found:', error);
    return null;
  }

  const expiresAt = new Date(data.expires_at);
  if (expiresAt < new Date()) {
    console.log('[Analytics Download API] Export expired');
    return null;
  }

  console.log('[Analytics Download API] Export found:', data.file_name);
  return data;
}

/**
 * Update download count
 */
async function updateDownloadCount(exportId: string) {
  const supabase = createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
  );

  await supabase
    .from('analytics_exports')
    .update({
      download_count: supabase.rpc('increment', { row_id: exportId }),
      last_downloaded_at: new Date().toISOString(),
    })
    .eq('id', exportId);

  console.log('[Analytics Download API] Download count updated');
}

/**
 * GET handler
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { error: authError, user } = await authenticateUser(req);
    if (authError || !user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const exportId = id;
    console.log('[Analytics Download API] Request from user:', user.id, 'for:', exportId);

    const exportRecord = await getExportRecord(exportId, user.id);
    if (!exportRecord) {
      return NextResponse.json(
        { error: 'Export not found or expired' },
        { status: 410 }
      );
    }

    const fileBuffer = await readExportFile(exportRecord.file_path);

    updateDownloadCount(exportId);

    const contentTypeMap: Record<string, string> = {
      csv: 'text/csv',
      json: 'application/json',
      report: 'application/json',
      html: 'text/html',
      pdf: 'application/pdf',
    };

    const contentType = contentTypeMap[exportRecord.format] || 'application/octet-stream';

    console.log('[Analytics Download API] Streaming file:', exportRecord.file_name);

    return new NextResponse(fileBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${exportRecord.file_name}"`,
        'Content-Length': exportRecord.file_size.toString(),
      },
    });
  } catch (error) {
    console.error('[Analytics Download API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to download export' },
      { status: 500 }
    );
  }
}
