/**
 * Validation History API
 *
 * Endpoints for viewing validation history and results
 *
 * Phase: Phase 4 - Regression Gates
 * Date: 2025-10-28
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBaselineManager } from '@/lib/services/baseline-manager';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/training/validations?modelName=xxx&limit=10
 * Get validation history for a model
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[Validations-API] GET: Unauthorized - no auth header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE'
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('[Validations-API] GET: Auth failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const modelName = searchParams.get('modelName');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    if (!modelName) {
      return NextResponse.json(
        { error: 'modelName query parameter is required' },
        { status: 400 }
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    const baselineManager = getBaselineManager();
    const validations = await baselineManager.getValidationHistory(modelName, limit);

    return NextResponse.json({
      success: true,
      modelName,
      count: validations.length,
      validations,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Validations-API] Error fetching validation history:', errorMessage);

    return NextResponse.json(
      { error: 'Failed to fetch validation history', details: errorMessage },
      { status: 500 }
    );
  }
}
