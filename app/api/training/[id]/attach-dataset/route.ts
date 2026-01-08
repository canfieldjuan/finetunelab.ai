// Attach Dataset to Config API
// POST /api/training/{configId}/attach-dataset - Link dataset to config
// Date: 2025-10-16

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isFormatCompatible, getIncompatibilityReason } from '@/lib/training/format-validator';
import { TRAINING_METHODS } from '@/lib/constants';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  console.log('[AttachDatasetAPI] POST: Attaching dataset to config:', resolvedParams.id);

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
      console.error('[AttachDatasetAPI] Auth failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { datasetId } = await request.json();

    if (!datasetId) {
      return NextResponse.json({ error: 'datasetId required' }, { status: 400 });
    }

    const configId = resolvedParams.id;

    const { data: config, error: configError } = await supabase
      .from('training_configs')
      .select('id, user_id, config_json')
      .eq('id', configId)
      .eq('user_id', user.id)
      .single();

    if (configError || !config) {
      console.error('[AttachDatasetAPI] Config not found');
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }

    const { data: dataset, error: datasetError } = await supabase
      .from('training_datasets')
      .select('id, user_id, format, name')
      .eq('id', datasetId)
      .eq('user_id', user.id)
      .single();

    if (datasetError || !dataset) {
      console.error('[AttachDatasetAPI] Dataset not found');
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }

    const trainingMethod = config.config_json?.training?.method || TRAINING_METHODS.SFT;
    console.log('[AttachDatasetAPI] Checking compatibility: dataset format', dataset.format, 'with method', trainingMethod);

    if (!isFormatCompatible(dataset.format, trainingMethod)) {
      const reason = getIncompatibilityReason(dataset.format, trainingMethod);
      console.error('[AttachDatasetAPI] Format incompatible:', reason);
      return NextResponse.json({ error: reason }, { status: 400 });
    }

    console.log('[AttachDatasetAPI] Format compatible. Linking dataset', datasetId, 'to config', configId);

    // Use junction table for many-to-many relationship
    const { error: insertError } = await supabase
      .from('training_config_datasets')
      .insert({
        config_id: configId,
        dataset_id: datasetId,
        user_id: user.id,
      });

    if (insertError) {
      // Check if already attached
      if (insertError.code === '23505') { // Unique constraint violation
        console.log('[AttachDatasetAPI] Dataset already attached to this config');
        return NextResponse.json({ success: true, message: 'Dataset already attached' });
      }
      console.error('[AttachDatasetAPI] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to attach dataset' }, { status: 500 });
    }

    console.log('[AttachDatasetAPI] Dataset attached successfully via junction table');
    return NextResponse.json({ success: true, message: 'Dataset attached' });
  } catch (error) {
    console.error('[AttachDatasetAPI] Error:', error);
    return NextResponse.json({ error: 'Failed to attach dataset' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  console.log('[AttachDatasetAPI] DELETE: Detaching dataset from config:', resolvedParams.id);

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
      console.error('[AttachDatasetAPI] Auth failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { datasetId } = await request.json();

    if (!datasetId) {
      return NextResponse.json({ error: 'datasetId required' }, { status: 400 });
    }

    console.log('[AttachDatasetAPI] Detaching dataset', datasetId);

    // Delete from junction table instead of nullifying config_id
    const { error: deleteError } = await supabase
      .from('training_config_datasets')
      .delete()
      .eq('config_id', resolvedParams.id)
      .eq('dataset_id', datasetId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('[AttachDatasetAPI] Detach error:', deleteError);
      return NextResponse.json({ error: 'Failed to detach dataset' }, { status: 500 });
    }

    console.log('[AttachDatasetAPI] Dataset detached successfully from junction table');
    return NextResponse.json({ success: true, message: 'Dataset detached' });
  } catch (error) {
    console.error('[AttachDatasetAPI] Error:', error);
    return NextResponse.json({ error: 'Failed to detach dataset' }, { status: 500 });
  }
}

console.log('[AttachDatasetAPI] Attach dataset API loaded');
