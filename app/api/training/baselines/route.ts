/**
 * Baseline Management API
 *
 * Endpoints for managing model baselines and viewing validation history
 *
 * Phase: Phase 4 - Regression Gates
 * Date: 2025-10-28
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBaselineManager } from '@/lib/services/baseline-manager';
import type { Baseline } from '@/lib/services/baseline-manager';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/training/baselines?modelName=xxx
 * Get all baselines for a model
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[Baselines-API] GET: Unauthorized - no auth header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('[Baselines-API] GET: Auth failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const modelName = searchParams.get('modelName');
    const version = searchParams.get('version') || undefined;

    if (!modelName) {
      return NextResponse.json(
        { error: 'modelName query parameter is required' },
        { status: 400 }
      );
    }

    const baselineManager = getBaselineManager();
    const baselines = await baselineManager.getBaselines(modelName, version);

    return NextResponse.json({
      success: true,
      modelName,
      version,
      count: baselines.length,
      baselines,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Baselines-API] Error fetching baselines:', errorMessage);

    return NextResponse.json(
      { error: 'Failed to fetch baselines', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/training/baselines
 * Create a new baseline
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[Baselines-API] POST: Unauthorized - no auth header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('[Baselines-API] POST: Auth failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      modelName,
      version,
      metricName,
      metricCategory,
      baselineValue,
      thresholdType,
      thresholdValue,
      severity,
      alertEnabled = true,
      description,
      createdBy,
    } = body;

    // Validation
    if (!modelName || !metricName || baselineValue === undefined || !thresholdType || thresholdValue === undefined || !severity) {
      return NextResponse.json(
        { error: 'Missing required fields: modelName, metricName, baselineValue, thresholdType, thresholdValue, severity' },
        { status: 400 }
      );
    }

    if (!['min', 'max', 'delta', 'ratio'].includes(thresholdType)) {
      return NextResponse.json(
        { error: 'Invalid thresholdType. Must be: min, max, delta, or ratio' },
        { status: 400 }
      );
    }

    if (!['critical', 'warning', 'info'].includes(severity)) {
      return NextResponse.json(
        { error: 'Invalid severity. Must be: critical, warning, or info' },
        { status: 400 }
      );
    }

    const baselineManager = getBaselineManager();
    const baseline = await baselineManager.createBaseline({
      modelName,
      version,
      metricName,
      metricCategory: metricCategory || 'accuracy',
      baselineValue: parseFloat(baselineValue),
      thresholdType,
      thresholdValue: parseFloat(thresholdValue),
      severity,
      alertEnabled,
      description,
      createdBy,
    });

    return NextResponse.json({
      success: true,
      message: 'Baseline created successfully',
      baseline,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Baselines-API] Error creating baseline:', errorMessage);

    return NextResponse.json(
      { error: 'Failed to create baseline', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/training/baselines/:id
 * Update an existing baseline
 */
export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[Baselines-API] PUT: Unauthorized - no auth header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('[Baselines-API] PUT: Auth failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Baseline ID is required in query params' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      baselineValue,
      thresholdValue,
      thresholdType,
      severity,
      alertEnabled,
      description,
    } = body;

    const updates: Partial<Baseline> = {};
    if (baselineValue !== undefined) updates.baselineValue = parseFloat(baselineValue);
    if (thresholdValue !== undefined) updates.thresholdValue = parseFloat(thresholdValue);
    if (thresholdType !== undefined) updates.thresholdType = thresholdType;
    if (severity !== undefined) updates.severity = severity;
    if (alertEnabled !== undefined) updates.alertEnabled = alertEnabled;
    if (description !== undefined) updates.description = description;

    const baselineManager = getBaselineManager();
    const baseline = await baselineManager.updateBaseline(id, updates);

    return NextResponse.json({
      success: true,
      message: 'Baseline updated successfully',
      baseline,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Baselines-API] Error updating baseline:', errorMessage);

    return NextResponse.json(
      { error: 'Failed to update baseline', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/training/baselines/:id
 * Delete a baseline
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[Baselines-API] DELETE: Unauthorized - no auth header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('[Baselines-API] DELETE: Auth failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Baseline ID is required in query params' },
        { status: 400 }
      );
    }

    const baselineManager = getBaselineManager();
    await baselineManager.deleteBaseline(id);

    return NextResponse.json({
      success: true,
      message: 'Baseline deleted successfully',
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Baselines-API] Error deleting baseline:', errorMessage);

    return NextResponse.json(
      { error: 'Failed to delete baseline', details: errorMessage },
      { status: 500 }
    );
  }
}
