// Training Dataset API - Individual Dataset Operations
// DELETE /api/training/dataset/{id} - Delete dataset
// Date: 2025-10-16

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  console.log('[DatasetAPI] GET: Fetching dataset preview:', resolvedParams.id);

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[DatasetAPI] Auth failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const datasetId = resolvedParams.id;

    const { data: dataset, error: fetchError } = await supabase
      .from('training_datasets')
      .select('*')
      .eq('id', datasetId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !dataset) {
      console.error('[DatasetAPI] Dataset not found');
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }

    console.log('[DatasetAPI] Downloading file from storage:', dataset.storage_path);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('training-datasets')
      .download(dataset.storage_path);

    if (downloadError || !fileData) {
      console.error('[DatasetAPI] Download error:', downloadError);
      return NextResponse.json({ error: 'Failed to download dataset' }, { status: 500 });
    }

    // Check if file is gzip compressed
    let fileText: string;
    if (dataset.storage_path.endsWith('.gz')) {
      console.log('[DatasetAPI] Detected gzip compressed file, decompressing...');
      
      // Decompress the data
      const compressedData = await fileData.arrayBuffer();
      const decompressionStream = new DecompressionStream('gzip');
      const decompressedStream = new Response(
        new Blob([compressedData]).stream().pipeThrough(decompressionStream)
      );
      fileText = await decompressedStream.text();
      
      console.log('[DatasetAPI] Decompressed size:', fileText.length, 'bytes');
    } else {
      fileText = await fileData.text();
    }

    const lines = fileText.trim().split('\n');

    const paginatedLines = lines.slice(offset, offset + limit);
    const examples = paginatedLines.map((line, index) => {
      try {
        return { index: offset + index, data: JSON.parse(line) };
      } catch {
        return { index: offset + index, data: line, error: 'Invalid JSON' };
      }
    });

    console.log('[DatasetAPI] Returning', examples.length, 'examples');

    return NextResponse.json({
      examples,
      total: lines.length,
      offset,
      limit,
      has_more: offset + limit < lines.length,
    });
  } catch (error) {
    console.error('[DatasetAPI] Preview error:', error);
    return NextResponse.json({ error: 'Failed to fetch preview' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  console.log('[DatasetAPI] DELETE: Deleting dataset:', resolvedParams.id);

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[DatasetAPI] Auth failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const datasetId = resolvedParams.id;

    const { data: dataset, error: fetchError } = await supabase
      .from('training_datasets')
      .select('id, user_id, storage_path')
      .eq('id', datasetId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !dataset) {
      console.error('[DatasetAPI] Dataset not found');
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }

    console.log('[DatasetAPI] Deleting storage file:', dataset.storage_path);

    const { error: storageError } = await supabase.storage
      .from('training-datasets')
      .remove([dataset.storage_path]);

    if (storageError) {
      console.error('[DatasetAPI] Storage delete error:', storageError);
    }

    const { error: dbError } = await supabase
      .from('training_datasets')
      .delete()
      .eq('id', datasetId)
      .eq('user_id', user.id);

    if (dbError) {
      console.error('[DatasetAPI] Database delete error:', dbError);
      return NextResponse.json({ error: 'Failed to delete dataset' }, { status: 500 });
    }

    console.log('[DatasetAPI] Dataset deleted successfully:', datasetId);
    return NextResponse.json({ success: true, message: 'Dataset deleted' });
  } catch (error) {
    console.error('[DatasetAPI] Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete dataset' }, { status: 500 });
  }
}

console.log('[DatasetAPI] Individual dataset API loaded');
