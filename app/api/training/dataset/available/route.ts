import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/training/dataset/available
 * 
 * Returns user's datasets in dropdown-friendly format
 * Used by DAG Builder for dataset selection
 */
export async function GET(request: NextRequest) {
  console.log('[DatasetAvailableAPI] GET - Fetching available datasets');

  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.log('[DatasetAvailableAPI] Missing auth header');
      return NextResponse.json(
        { error: 'Unauthorized - missing auth header' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[DatasetAvailableAPI] Auth failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    console.log('[DatasetAvailableAPI] User authenticated:', user.id);

    // Fetch datasets for this user
    const { data, error } = await supabase
      .from('training_datasets')
      .select('id, name, format, total_examples, storage_path, file_size_bytes, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DatasetAvailableAPI] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch datasets', details: error.message },
        { status: 500 }
      );
    }

    console.log('[DatasetAvailableAPI] Found', data.length, 'datasets');

    // Format for dropdown
    const datasets = data.map((d) => ({
      id: d.id,
      name: d.name,
      format: d.format,
      totalExamples: d.total_examples,
      storagePath: d.storage_path,
      fileSizeMB: (d.file_size_bytes / 1024 / 1024).toFixed(2),
      createdAt: d.created_at,
      displayLabel: `${d.name} (${d.format}, ${d.total_examples.toLocaleString()} examples)`,
    }));

    return NextResponse.json({
      success: true,
      datasets,
      count: datasets.length,
    });

  } catch (error) {
    console.error('[DatasetAvailableAPI] Unexpected error:', error);
    const details = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Internal server error', details },
      { status: 500 }
    );
  }
}
