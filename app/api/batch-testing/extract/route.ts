/**
 * API Route - Batch Testing Extract Prompts
 *
 * Extracts prompts from Claude Desktop conversation JSON files.
 * POST /api/batch-testing/extract
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractPrompts } from '@/lib/tools/prompt-extractor/prompt-extractor.service';

// Use Node.js runtime for file system operations
export const runtime = 'nodejs';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    console.log('[Batch Testing Extract] Request received');

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
      source_path,
      limit = 50
    } = body;

    // Validate source path
    if (!source_path || typeof source_path !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid source_path' },
        { status: 400 }
      );
    }

    console.log('[Batch Testing Extract] Extracting prompts:', {
      userId: user.id,
      source_path,
      limit
    });

    // Extract prompts using existing prompt-extractor service
    const result = await extractPrompts({
      directory: source_path,
      filePattern: '.json',
      maxPrompts: limit
    });

    console.log('[Batch Testing Extract] Extraction complete:', {
      total: result.total,
      filesProcessed: result.filesProcessed,
      errors: result.errors?.length || 0
    });

    return NextResponse.json({
      success: true,
      prompts: result.prompts,
      total: result.total,
      files_processed: result.filesProcessed,
      errors: result.errors
    });

  } catch (error) {
    console.error('[Batch Testing Extract] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}