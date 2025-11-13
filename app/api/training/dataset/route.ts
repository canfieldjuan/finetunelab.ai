// Training Dataset Upload API
// POST /api/training/dataset - Upload new dataset
// GET /api/training/dataset - List user datasets
// Date: 2025-10-16
// Updated: 2025-11-01 - Integrated format normalization

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { datasetValidator } from '@/lib/training/dataset-validator';
import { normalizedToJsonl } from '@/lib/training/format-normalizer';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  console.log('[DatasetAPI] POST: Uploading dataset');

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[DatasetAPI] Auth failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string | null;
    const format = formData.get('format') as 'chatml' | 'sharegpt' | 'jsonl' | 'dpo' | 'rlhf';
    const configId = formData.get('config_id') as string | null;

    if (!file || !name || !format) {
      console.error('[DatasetAPI] Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log('[DatasetAPI] Validating dataset:', name);
    console.log('[DatasetAPI] User-specified format:', format);

    // NEW: Use validation with normalization
    let validation;
    try {
      validation = await datasetValidator.validateWithNormalization(file);
    } catch (validationError) {
      console.error('[DatasetAPI] Validation threw error:', validationError);
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationError instanceof Error ? validationError.message : 'Unknown validation error'
        },
        { status: 400 }
      );
    }
    
    if (!validation.valid) {
      console.error('[DatasetAPI] Validation failed:', validation.errors);
      return NextResponse.json(
        { error: 'Invalid dataset', details: validation.errors },
        { status: 400 }
      );
    }

    console.log('[DatasetAPI] Valid dataset, detected format:', validation.detectedFormat);
    console.log('[DatasetAPI] Normalized examples:', validation.normalized?.stats.convertedCount);

    // Convert normalized data to JSONL for storage
    let normalizedJsonl;
    try {
      normalizedJsonl = normalizedToJsonl(validation.normalized!.data);
      console.log('[DatasetAPI] JSONL conversion successful, length:', normalizedJsonl.length);
    } catch (jsonlError) {
      console.error('[DatasetAPI] JSONL conversion failed:', jsonlError);
      return NextResponse.json(
        { 
          error: 'Failed to convert to JSONL',
          details: jsonlError instanceof Error ? jsonlError.message : 'Unknown conversion error'
        },
        { status: 500 }
      );
    }
    
    // Compress the JSONL data using gzip
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(normalizedJsonl);
    
    // Use compression stream (available in Node.js and modern browsers)
    const compressionStream = new CompressionStream('gzip');
    const writer = compressionStream.writable.getWriter();
    writer.write(encodedData);
    writer.close();
    
    const compressedData = await new Response(compressionStream.readable).arrayBuffer();
    const normalizedBlob = new Blob([compressedData], { type: 'application/gzip' });

    console.log('[DatasetAPI] Original size:', encodedData.length, 'bytes');
    console.log('[DatasetAPI] Compressed size:', normalizedBlob.size, 'bytes');
    console.log('[DatasetAPI] Compression ratio:', (100 - (normalizedBlob.size / encodedData.length * 100)).toFixed(1) + '%');
    console.log('[DatasetAPI] Uploading compressed dataset');

    const datasetId = crypto.randomUUID();
    const storagePath = `${user.id}/private/${datasetId}.jsonl.gz`;

    const { error: uploadError } = await supabase.storage
      .from('training-datasets')
      .upload(storagePath, normalizedBlob);

    if (uploadError) {
      console.error('[DatasetAPI] Upload error:', uploadError);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    console.log('[DatasetAPI] Normalized dataset uploaded');

    const { data, error } = await supabase
      .from('training_datasets')
      .insert({
        id: datasetId,
        user_id: user.id,
        config_id: configId,
        name,
        description,
        format, // Keep user-specified format for UI display
        file_size_bytes: normalizedBlob.size,
        total_examples: validation.stats!.total_examples,
        avg_input_length: validation.stats!.avg_input_length,
        avg_output_length: validation.stats!.avg_output_length,
        storage_path: storagePath,
        // Store detection metadata
        metadata: {
          original_format: validation.detectedFormat,
          normalized: true,
          compressed: true,
          compression_type: 'gzip',
          original_size_bytes: encodedData.length,
          normalization_date: new Date().toISOString(),
          errors: validation.errors || []
        }
      })
      .select()
      .single();

    if (error) {
      console.error('[DatasetAPI] Database error:', error);
      await supabase.storage.from('training-datasets').remove([storagePath]);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[DatasetAPI] Dataset created:', data.id);
    console.log('[DatasetAPI] Original format:', validation.detectedFormat);
    console.log('[DatasetAPI] Stored format: normalized JSONL');
    
    return NextResponse.json({ dataset: data });
  } catch (error) {
    console.error('[DatasetAPI] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[DatasetAPI] Error details:', {
      message: errorMessage,
      stack: errorStack,
      type: typeof error,
      error: error
    });
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  console.log('[DatasetAPI] GET: Fetching datasets');

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('training_datasets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DatasetAPI] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[DatasetAPI] Found', data.length, 'datasets');
    return NextResponse.json({ datasets: data });
  } catch (error) {
    console.error('[DatasetAPI] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
