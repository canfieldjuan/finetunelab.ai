/**
 * @swagger
 * /api/batch-testing/extract:
 *   post:
 *     summary: Extract prompts from conversations
 *     description: |
 *       Extract prompts from Claude Desktop conversation JSON files or other sources.
 *
 *       This is the first step before running batch tests - it extracts and validates
 *       prompts from your conversation history or custom JSON files.
 *
 *       **Use Cases:**
 *       - Prepare test datasets from production conversations
 *       - Extract prompts from exported chat histories
 *       - Build regression test suites from real user interactions
 *     tags:
 *       - Batch Testing
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - source_path
 *             properties:
 *               source_path:
 *                 type: string
 *                 description: Path to conversation JSON files
 *                 example: "/path/to/conversations"
 *               limit:
 *                 type: integer
 *                 default: 50
 *                 description: Maximum number of prompts to extract
 *                 example: 100
 *     responses:
 *       200:
 *         description: Prompts extracted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 total:
 *                   type: integer
 *                   description: Total prompts extracted
 *                   example: 87
 *                 prompts:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["What is machine learning?", "Explain neural networks"]
 *                 filesProcessed:
 *                   type: integer
 *                   description: Number of files scanned
 *                   example: 12
 *       400:
 *         description: Bad request - Invalid source path
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
      limit = parseInt(process.env.BATCH_TESTING_EXTRACT_LIMIT || '50', 10)
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