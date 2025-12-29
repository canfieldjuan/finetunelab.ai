/**
 * API Route - Export Generation
 *
 * Generates conversation exports in various formats.
 * POST /api/export/generate
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exportService } from '@/lib/export';
import {
  MarkdownFormatter,
  JsonFormatter,
  TxtFormatter,
  JsonlFormatter
} from '@/lib/export/formatters';
import type { ExportFormat } from '@/lib/export/types';

// Use Node.js runtime for file system operations
export const runtime = 'nodejs';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

// Register formatters on module load
exportService.registerFormatter('markdown', new MarkdownFormatter());
exportService.registerFormatter('json', new JsonFormatter());
exportService.registerFormatter('txt', new TxtFormatter());
exportService.registerFormatter('jsonl', new JsonlFormatter('full', true, true));

export async function POST(req: NextRequest) {
  // ⚠️ DEPRECATION WARNING
  console.warn('[DEPRECATED] POST /api/export/generate is deprecated. Please migrate to POST /api/export/v2');
  console.warn('[DEPRECATED] See migration guide: /docs/export-migration.md');
  console.warn('[DEPRECATED] This endpoint will be removed after 60-day grace period');

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

    // Parse request body
    const body = await req.json();
    const {
      conversationIds,
      format = 'markdown',
      includeMetadata = true,
      includeSystemMessages = false,
      dateRange,
      title
    } = body;

    // Validate conversation IDs
    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid conversationIds array' },
        { status: 400 }
      );
    }

    // Validate format
    const validFormats: ExportFormat[] = ['markdown', 'json', 'txt', 'pdf', 'html', 'jsonl'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    console.log('[Export] Generating export:', {
      userId: user.id,
      format,
      conversationCount: conversationIds.length
    });

    // Parse date range if provided
    const parsedDateRange = dateRange ? {
      start: new Date(dateRange.start),
      end: new Date(dateRange.end)
    } : undefined;

    // Generate export
    const result = await exportService.generate(user.id, {
      format,
      conversationIds,
      includeMetadata,
      includeSystemMessages,
      dateRange: parsedDateRange,
      title
    });

    console.log('[Export] Export generated successfully:', {
      exportId: result.id,
      fileSize: result.fileSize,
      conversationCount: result.conversationCount,
      messageCount: result.messageCount
    });

    return NextResponse.json({
      success: true,
      export: result
    });

  } catch (error) {
    console.error('[Export] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
