import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { documentService } from '@/lib/graphrag';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Try to upload file - if duplicate, automatically create new version
    let document;
    let isNewVersion = false;

    try {
      document = await documentService.uploadOnly(supabase, {
        userId: user.id,
        file,
        metadata: {
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (uploadError) {
      // If document exists, automatically create new version
      if (uploadError instanceof Error && uploadError.message === 'DOCUMENT_EXISTS_USE_UPDATE') {
        console.log('[GraphRAG Upload] Document exists, creating new version automatically');
        document = await documentService.updateDocument(supabase, {
          userId: user.id,
          file,
          metadata: {
            uploadedAt: new Date().toISOString(),
            updatedVia: 'api',
          },
        });
        isNewVersion = true;
      } else {
        throw uploadError;
      }
    }

    // Trigger background processing (fire-and-forget) only if not already processed
    if (!document.processed) {
      const baseUrl = request.nextUrl.origin;
      fetch(`${baseUrl}/api/graphrag/process/${document.id}`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      }).catch(err => {
        console.error(`[GraphRAG Upload] Failed to trigger background processing for ${document.id}:`, err);
      });

      console.log(`[GraphRAG Upload] Document ${document.id} uploaded, processing in background`);
    } else {
      console.log(`[GraphRAG Upload] Document ${document.id} already processed (version update)`);
    }

    return NextResponse.json({
      success: true,
      document,
      message: isNewVersion
        ? `New version (v${document.version}) created and processed successfully`
        : `File uploaded successfully. Processing in background...`,
      processing: !document.processed,
      isNewVersion,
    });
  } catch (error) {
    console.error('[GraphRAG Upload] Error:', error);

    // Handle other errors
    return NextResponse.json(
      {
        error: 'Failed to process file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
