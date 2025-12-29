// Training Datasets API
// GET /api/training/{id}/datasets - Fetch datasets attached to a training config
// Date: 2025-10-22

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';

export const runtime = 'nodejs';

console.log('[DatasetsAPI] Route loaded');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  console.log('[DatasetsAPI] GET: Fetching datasets for config:', resolvedParams.id);

  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[DatasetsAPI] No authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[DatasetsAPI] Auth failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[DatasetsAPI] User authenticated:', user.id);

    const configId = resolvedParams.id;

    // Verify user owns the config
    console.log('[DatasetsAPI] Verifying config ownership:', configId);
    const { data: config, error: configError } = await supabase
      .from('training_configs')
      .select('id')
      .eq('id', configId)
      .eq('user_id', user.id)
      .single();

    if (configError || !config) {
      console.error('[DatasetsAPI] Config not found or unauthorized:', configError);
      return NextResponse.json(
        { error: 'Training config not found' },
        { status: 404 }
      );
    }

    console.log('[DatasetsAPI] Config verified');

    // Fetch datasets via junction table (many-to-many)
    console.log('[DatasetsAPI] Fetching datasets via junction table...');
    const { data: configDatasets, error: junctionError } = await supabase
      .from('training_config_datasets')
      .select(`
        dataset_id,
        attached_at,
        training_datasets (
          id,
          name,
          storage_path,
          created_at,
          format,
          total_examples,
          file_size_bytes
        )
      `)
      .eq('config_id', configId)
      .eq('user_id', user.id);

    if (junctionError) {
      console.error('[DatasetsAPI] Error fetching datasets from junction table:', junctionError);
      return NextResponse.json(
        { error: 'Failed to fetch datasets' },
        { status: 500 }
      );
    }

    // Extract datasets from nested structure
    type ConfigDatasetRow = {
      dataset_id: string;
      attached_at: string;
      training_datasets: TrainingDatasetRecord | null;
    };

    const datasets = ((configDatasets || []) as unknown as ConfigDatasetRow[])
      .map((cd) => cd.training_datasets)
      .filter((d): d is TrainingDatasetRecord => d !== null);

    console.log(`[DatasetsAPI] Found ${datasets?.length || 0} datasets via junction table`);

    // Get file sizes from Supabase Storage using list() for efficiency
    console.log('[DatasetsAPI] Fetching file sizes using metadata API...');
    const datasetsWithSize = await Promise.all(
      (datasets || []).map(async (dataset) => {
        try {
          console.log(`[DatasetsAPI] Getting metadata for: ${dataset.storage_path}`);

          // Extract directory and filename from storage_path
          const pathParts = dataset.storage_path.split('/');
          const fileName = pathParts[pathParts.length - 1];
          const directory = pathParts.slice(0, -1).join('/');

          console.log(`[DatasetsAPI] Directory: ${directory}, File: ${fileName}`);

          // Use list() to get file metadata without downloading
          const { data: files, error: listError } = await supabase.storage
            .from('training-datasets')
            .list(directory, {
              limit: 100,
              offset: 0,
              sortBy: { column: 'name', order: 'asc' }
            });

          if (listError || !files) {
            console.warn(`[DatasetsAPI] Failed to list files in ${directory}:`, listError);
            return { ...dataset, size: 0 };
          }

          // Find the specific file in the listing
          const fileInfo = files.find((f) => f.name === fileName);

          if (!fileInfo) {
            console.warn(`[DatasetsAPI] File ${fileName} not found in directory listing`);
            return { ...dataset, size: 0 };
          }

          // Get size from metadata - try multiple possible properties
          const metadata = fileInfo.metadata as Record<string, unknown> | undefined;
          const fileInfoAny = fileInfo as unknown as Record<string, unknown>;
          const size =
            (typeof metadata?.size === 'number' ? metadata.size : undefined) ??
            (typeof metadata?.contentLength === 'number' ? metadata.contentLength : undefined) ??
            (typeof fileInfoAny.size === 'number' ? fileInfoAny.size : undefined) ??
            0;
          console.log(`[DatasetsAPI] Dataset ${dataset.id} size: ${size} bytes (from metadata)`);
          console.log(`[DatasetsAPI] File metadata:`, JSON.stringify(metadata || {}));

          return { ...dataset, size };
        } catch (err) {
          console.error(`[DatasetsAPI] Error getting metadata for ${dataset.id}:`, err);
          return { ...dataset, size: 0 };
        }
      })
    );

    console.log('[DatasetsAPI] Returning datasets with sizes');

    return NextResponse.json({
      success: true,
      datasets: datasetsWithSize,
    });

  } catch (error) {
    console.error('[DatasetsAPI] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch datasets' },
      { status: 500 }
    );
  }
}

console.log('[DatasetsAPI] Route handlers defined');
