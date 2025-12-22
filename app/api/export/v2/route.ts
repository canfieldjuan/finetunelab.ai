/**
 * Unified Export API - v2
 * Phase 4: API Migration
 *
 * Handles export creation for all types: conversation, analytics, trace, custom
 * POST /api/export/v2 - Create new export
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getUnifiedExportService,
  ConversationDataLoader,
  AnalyticsDataLoader,
  TraceDataLoader,
  JSONFormatter,
  CSVFormatter,
  JSONLFormatter,
  MarkdownFormatter,
  TXTFormatter,
  FilesystemStorage,
} from '@/lib/export-unified';
import type {
  ExportRequest,
  ExportType,
  ExportFormat,
  DataSelector,
  ExportOptions,
} from '@/lib/export-unified';
import { unifiedExportConfig } from '@/lib/export-unified';

/**
 * Initialize unified export service with all loaders and formatters
 */
function initializeExportService() {
  const service = getUnifiedExportService();

  // Check if already initialized
  if (service.isReady()) {
    return service;
  }

  // Register data loaders
  service.registerLoader('conversation', new ConversationDataLoader());
  service.registerLoader('analytics', new AnalyticsDataLoader());
  service.registerLoader('trace', new TraceDataLoader());

  // Register formatters
  service.registerFormatter('json', new JSONFormatter());
  service.registerFormatter('csv', new CSVFormatter());
  service.registerFormatter('jsonl', new JSONLFormatter());
  service.registerFormatter('markdown', new MarkdownFormatter());
  service.registerFormatter('txt', new TXTFormatter());

  // Set up storage
  const storage = new FilesystemStorage(unifiedExportConfig.storagePath);
  storage.initialize().catch((err) => {
    console.error('[Export API] Failed to initialize storage:', err);
  });
  service.setStorageProvider(storage);

  return service;
}

/**
 * POST /api/export/v2
 * Create a new export
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const {
      exportType,
      format,
      dataSelector,
      options,
    }: {
      exportType: ExportType;
      format: ExportFormat;
      dataSelector: DataSelector;
      options?: ExportOptions;
    } = body;

    // Validate required fields
    if (!exportType) {
      return NextResponse.json({ error: 'exportType is required' }, { status: 400 });
    }

    if (!format) {
      return NextResponse.json({ error: 'format is required' }, { status: 400 });
    }

    if (!dataSelector) {
      return NextResponse.json({ error: 'dataSelector is required' }, { status: 400 });
    }

    // Validate export type matches selector type
    if (dataSelector.type !== exportType) {
      return NextResponse.json(
        {
          error: `Export type (${exportType}) does not match selector type (${dataSelector.type})`,
        },
        { status: 400 }
      );
    }

    // Build export request
    const exportRequest: ExportRequest = {
      userId: user.id,
      exportType,
      format,
      dataSelector,
      options,
    };

    // Initialize and generate export
    console.log('[Export API] Creating export:', {
      userId: user.id,
      exportType,
      format,
    });

    const service = initializeExportService();
    const result = await service.generateExport(exportRequest);

    console.log('[Export API] Export created successfully:', {
      id: result.id,
      size: result.fileSize,
    });

    // Return export info
    return NextResponse.json({
      success: true,
      export: {
        id: result.id,
        downloadUrl: result.downloadUrl,
        expiresAt: result.expiresAt.toISOString(),
        fileSize: result.fileSize,
        format: result.format,
        exportType: result.exportType,
        status: result.status,
        metadata: result.metadata,
      },
    });
  } catch (error) {
    console.error('[Export API] Error creating export:', error);

    // Return user-friendly error
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

/**
 * GET /api/export/v2
 * List user's exports
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const showExpired = searchParams.get('showExpired') === 'true';
    const exportType = searchParams.get('exportType') as ExportType | null;

    // Initialize service and list exports
    const service = initializeExportService();
    const exports = await service.listExports(user.id, {
      limit,
      showExpired,
      exportType: exportType || undefined,
    });

    console.log('[Export API] Listed exports:', {
      userId: user.id,
      count: exports.length,
    });

    // Return exports list
    return NextResponse.json({
      success: true,
      exports: exports.map((exp) => ({
        id: exp.id,
        exportType: exp.exportType,
        format: exp.format,
        fileName: exp.fileName,
        fileSize: exp.fileSize,
        status: exp.status,
        downloadCount: exp.downloadCount,
        createdAt: exp.createdAt.toISOString(),
        expiresAt: exp.expiresAt.toISOString(),
        lastDownloadedAt: exp.lastDownloadedAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[Export API] Error listing exports:', error);

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
