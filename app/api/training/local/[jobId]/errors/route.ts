/**
 * Training Errors API
 * GET /api/training/local/[jobId]/errors
 *
 * Purpose: Get structured error information from training log files
 * - Deduplicated error messages with counts
 * - Full traceback with parsed frames
 * - Error classification and phase information
 *
 * Date: 2025-12-12
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateRequestWithScope } from '@/lib/auth/api-key-validator';

export const runtime = 'nodejs';

const TRAINING_SERVER_URL = process.env.TRAINING_SERVER_URL || 'http://localhost:8000';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  console.log('[LocalTraining Errors] GET errors for job:', jobId);

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials' },
      { status: 500 }
    );
  }

  try {
    let userId: string | null = null;

    const apiKeyValidation = await validateRequestWithScope(request.headers, 'training');

    if (apiKeyValidation.isValid && apiKeyValidation.userId) {
      userId = apiKeyValidation.userId;
    } else {
      const authHeader = request.headers.get('authorization');
      if (!authHeader) {
        return NextResponse.json(
          { error: 'Unauthorized: Missing authentication' },
          { status: 401 }
        );
      }

      if (!supabaseAnonKey) {
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        );
      }

      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

      if (authError || !user) {
        console.error('[LocalTraining Errors] Auth error:', authError);
        return NextResponse.json(
          { error: 'Unauthorized: Invalid token' },
          { status: 401 }
        );
      }

      userId = user.id;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('id, user_id')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (jobError || !job) {
      console.error('[LocalTraining Errors] Job not found or unauthorized:', jobError);
      return NextResponse.json(
        { error: 'Job not found or unauthorized' },
        { status: 404 }
      );
    }
    const url = `${TRAINING_SERVER_URL}/api/training/${jobId}/errors`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[LocalTraining Errors] Error from training server:', errorData);

      return NextResponse.json(
        { error: errorData.error || `Training server error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[LocalTraining Errors] Retrieved', data.unique_error_count || 0, 'unique errors');

    return NextResponse.json(data);

  } catch (error) {
    console.error('[LocalTraining Errors] Failed to connect to training server:', error);
    return NextResponse.json(
      {
        error: 'Failed to connect to local training server',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}
