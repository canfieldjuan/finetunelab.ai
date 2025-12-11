/**
 * Local Training Predictions Persistence API
 * POST /api/training/local/predictions
 *
 * Purpose: Batch insert training predictions for UI display
 * Called by: Python training script via predictions_writer.py
 * Phase: Predictions Persistence
 * Date: 2025-12-01
 * Auth: Requires job token authentication via Bearer token
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[LocalTrainingPredictions] CRITICAL: Missing environment variables!');
  console.error('[LocalTrainingPredictions] NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('[LocalTrainingPredictions] SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'SET' : 'MISSING');
}

interface PredictionRecord {
  job_id: string;
  user_id: string;
  epoch: number;
  step: number;
  sample_index: number;
  prompt: string;
  prediction: string;
  ground_truth?: string;
  // Quality metrics (populated when ground_truth exists)
  exact_match?: number;
  char_error_rate?: number;
  length_ratio?: number;
  word_overlap?: number;
}

export async function POST(request: NextRequest) {
  console.log('[LocalTrainingPredictions] POST request received');

  // Verify Supabase configuration
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials' },
      { status: 500 }
    );
  }

  try {
    // Check if request has a body
    const contentLength = request.headers.get('content-length');
    if (!contentLength || contentLength === '0') {
      console.log('[LocalTrainingPredictions] Empty request body received');
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      );
    }

    // Parse JSON with error handling
    let body;
    try {
      const clonedRequest = request.clone();
      const rawText = await clonedRequest.text();

      if (!rawText || rawText.trim().length === 0) {
        console.error('[LocalTrainingPredictions] Empty request body received');
        return NextResponse.json(
          { error: 'Empty request body' },
          { status: 400 }
        );
      }

      body = JSON.parse(rawText);
    } catch (parseError) {
      console.error('[LocalTrainingPredictions] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { job_id, predictions } = body;

    console.log('[LocalTrainingPredictions] Persisting predictions for job:', job_id);
    console.log('[LocalTrainingPredictions] Predictions count:', predictions?.length || 0);

    if (!job_id) {
      return NextResponse.json(
        { error: 'job_id is required' },
        { status: 400 }
      );
    }

    if (!predictions || !Array.isArray(predictions) || predictions.length === 0) {
      return NextResponse.json(
        { error: 'predictions array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Verify job_token authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[LocalTrainingPredictions] Missing or invalid authorization header');
      return NextResponse.json(
        { error: 'Unauthorized: Bearer token required' },
        { status: 401 }
      );
    }

    const jobToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the job exists and token matches
    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('id, user_id, job_token')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      console.error('[LocalTrainingPredictions] Job not found:', job_id);
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.job_token !== jobToken) {
      console.error('[LocalTrainingPredictions] Invalid job token');
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    // Prepare predictions data for insertion
    const predictionsData = predictions.map((p: PredictionRecord) => ({
      job_id: p.job_id,
      user_id: p.user_id,
      epoch: p.epoch,
      step: p.step,
      sample_index: p.sample_index,
      prompt: p.prompt,
      prediction: p.prediction,
      ground_truth: p.ground_truth ?? null,
      // Quality metrics (optional - only present when ground_truth exists)
      exact_match: p.exact_match ?? null,
      char_error_rate: p.char_error_rate ?? null,
      length_ratio: p.length_ratio ?? null,
      word_overlap: p.word_overlap ?? null
    }));

    const { data, error } = await supabase
      .from('training_predictions')
      .insert(predictionsData)
      .select();

    if (error) {
      console.error('[LocalTrainingPredictions] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to persist predictions', details: error.message },
        { status: 500 }
      );
    }

    console.log('[LocalTrainingPredictions] Persisted', data?.length || 0, 'predictions');

    return NextResponse.json({
      success: true,
      count: data?.length || 0
    });

  } catch (error) {
    console.error('[LocalTrainingPredictions] Request error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
