// Public Dataset API
// GET /api/training/public/{public_id}/dataset - Get public datasets
// No authentication required
// Date: 2025-10-16

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';

export const runtime = 'nodejs';

// CORS headers for cross-origin access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  console.log('[PublicDatasetAPI] GET: Fetching datasets for:', resolvedParams.id);

  try {
    const publicId = resolvedParams.id;

    if (!publicId) {
      return NextResponse.json(
        { error: 'Public ID required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // First, verify the config is public
    const { data: config, error: configError } = await supabase
      .from('training_configs')
      .select('id')
      .eq('public_id', publicId)
      .eq('is_public', true)
      .single();

    if (configError || !config) {
      console.error('[PublicDatasetAPI] Config not found or not public');
      return NextResponse.json(
        { error: 'Config not found or not public' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Fetch datasets linked to this config via junction table
    const { data: configDatasets, error: datasetsError } = await supabase
      .from('training_config_datasets')
      .select(`
        training_datasets (*)
      `)
      .eq('config_id', config.id);

    if (datasetsError) {
      console.error('[PublicDatasetAPI] Error fetching datasets:', datasetsError);
      return NextResponse.json(
        { error: 'Failed to fetch datasets' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Extract datasets from junction table
    type ConfigDatasetRow = {
      training_datasets: TrainingDatasetRecord | null;
    };

    const datasets = ((configDatasets || []) as unknown as ConfigDatasetRow[])
      .map((cd) => cd.training_datasets)
      .filter((d): d is TrainingDatasetRecord => d !== null);

    // Generate signed URLs for each dataset (valid for 1 hour)
    const datasetsWithUrls = await Promise.all(
      (datasets || []).map(async (dataset) => {
        const { data: urlData } = await supabase.storage
          .from('training-datasets')
          .createSignedUrl(dataset.storage_path, 3600);

        return {
          ...dataset,
          download_url: urlData?.signedUrl || null,
        };
      })
    );

    console.log('[PublicDatasetAPI] Found', datasetsWithUrls.length, 'datasets');
    return NextResponse.json(
      { datasets: datasetsWithUrls },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[PublicDatasetAPI] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch datasets' },
      { status: 500, headers: corsHeaders }
    );
  }
}
