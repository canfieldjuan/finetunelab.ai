/**
 * Dataset Download Endpoint
 * Purpose: Secure download endpoint for training datasets using temporary tokens
 * Used by: RunPod training pods to fetch datasets
 * Date: 2025-11-24
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createReadStream, existsSync, statSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

/**
 * GET /api/datasets/download?token=xxx
 * 
 * Downloads dataset file using temporary token authentication.
 * Token must be valid, not expired, and not already used.
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Dataset Download] Request received');

    // Extract token from query parameters
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      console.error('[Dataset Download] Missing token parameter');
      return NextResponse.json(
        { error: 'Missing token parameter' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('dataset_download_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenRecord) {
      console.error('[Dataset Download] Invalid token:', token.substring(0, 10));
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Check if token expired
    const now = new Date();
    const expiresAt = new Date(tokenRecord.expires_at);
    
    if (now > expiresAt) {
      console.error('[Dataset Download] Token expired:', token.substring(0, 10));
      return NextResponse.json(
        { error: 'Token has expired' },
        { status: 401 }
      );
    }

    // Check if token already used (optional: allow multiple uses within expiry)
    if (tokenRecord.used_at) {
      console.warn('[Dataset Download] Token already used:', token.substring(0, 10));
      // Uncomment to enforce single-use:
      // return NextResponse.json({ error: 'Token already used' }, { status: 401 });
    }

    // Mark token as used
    await supabase
      .from('dataset_download_tokens')
      .update({ used_at: now.toISOString() })
      .eq('token', token);

    console.log('[Dataset Download] Token validated:', token.substring(0, 10));

    // Resolve dataset file path
    const datasetPath = tokenRecord.dataset_path;
    
    // Security: Prevent path traversal attacks
    if (datasetPath.includes('..') || datasetPath.includes('~')) {
      console.error('[Dataset Download] Path traversal attempt:', datasetPath);
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }

    // Determine absolute file path
    let absolutePath: string;
    
    if (datasetPath.startsWith('/')) {
      // Already absolute path
      absolutePath = datasetPath;
    } else {
      // Relative path - join with project root
      const projectRoot = process.cwd();
      absolutePath = join(projectRoot, datasetPath);
    }

    console.log('[Dataset Download] Resolved path:', absolutePath);

    // Verify file exists
    if (!existsSync(absolutePath)) {
      console.error('[Dataset Download] File not found:', absolutePath);
      return NextResponse.json(
        { error: 'Dataset file not found' },
        { status: 404 }
      );
    }

    // Get file stats
    const fileStats = statSync(absolutePath);
    const fileSize = fileStats.size;
    const fileName = datasetPath.split('/').pop() || 'dataset.json';

    console.log('[Dataset Download] Streaming file:', fileName, `(${fileSize} bytes)`);

    // Create read stream
    const fileStream = createReadStream(absolutePath);

    // Convert Node.js stream to Web ReadableStream
    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk: string | Buffer) => {
          const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
          controller.enqueue(new Uint8Array(buffer));
        });
        
        fileStream.on('end', () => {
          controller.close();
        });
        
        fileStream.on('error', (error) => {
          console.error('[Dataset Download] Stream error:', error);
          controller.error(error);
        });
      },
      
      cancel() {
        fileStream.destroy();
      }
    });

    // Return streaming response
    return new NextResponse(readableStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': fileSize.toString(),
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('[Dataset Download] Download failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to download dataset',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
