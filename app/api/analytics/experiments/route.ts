/**
 * API Route - A/B Testing Experiments Management
 *
 * Manages experiments, variants, and traffic splitting for A/B testing
 *
 * GET /api/analytics/experiments - List experiments
 * POST /api/analytics/experiments - Create new experiment
 * PATCH /api/analytics/experiments - Update experiment
 * DELETE /api/analytics/experiments - Delete experiment
 *
 * Phase 1.3: A/B Testing Backend
 * Date: 2025-10-25
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

type ExperimentType = 'ab_test' | 'multivariate' | 'holdout' | string;

type VariantConfig = Record<string, unknown>;
type Metadata = Record<string, unknown>;

interface VariantInput {
  name: string;
  description?: string;
  is_control?: boolean;
  configuration?: VariantConfig;
  traffic_percentage: number;
}

interface ExperimentInput {
  name: string;
  description?: string;
  hypothesis?: string;
  experiment_type: ExperimentType;
  primary_metric: string;
  secondary_metrics?: string[];
  traffic_percentage?: number;
  start_date?: string;
  end_date?: string;
  tags?: string[];
  metadata?: Metadata;
  variants: VariantInput[];
}

function debugLog(context: string, data: unknown) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Experiments API - ${context}]`, data);
  }
}

/**
 * GET - List experiments with optional filtering
 */
export async function GET(req: NextRequest) {
  debugLog('GET', 'Request received');

  try {
    // Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    debugLog('GET', `User authenticated: ${user.id}`);

    // Extract query parameters
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const experiment_type = searchParams.get('experiment_type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('ab_experiments')
      .select(`
        *,
        ab_experiment_variants (
          id,
          name,
          description,
          is_control,
          traffic_percentage,
          total_sessions,
          successful_sessions,
          average_rating,
          conversion_rate
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (experiment_type) {
      query = query.eq('experiment_type', experiment_type);
    }

    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data: experiments, error: queryError } = await query;

    if (queryError) {
      debugLog('GET', `Query error: ${queryError.message}`);
      return NextResponse.json(
        { error: `Failed to retrieve experiments: ${queryError.message}` },
        { status: 500 }
      );
    }

    debugLog('GET', `Retrieved ${experiments?.length || 0} experiments`);

    return NextResponse.json({
      success: true,
      data: experiments,
      pagination: {
        limit,
        offset,
        total: experiments?.length || 0
      }
    });

  } catch (error) {
    console.error('[Experiments API - GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new experiment with variants
 */
export async function POST(req: NextRequest) {
  debugLog('POST', 'Request received');

  try {
    // Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    debugLog('POST', `User authenticated: ${user.id}`);

    // Parse request body
    const body = (await req.json()) as ExperimentInput;
    const {
      name,
      description,
      hypothesis,
      experiment_type,
      primary_metric,
      secondary_metrics,
      traffic_percentage,
      start_date,
      end_date,
      tags,
      metadata,
      variants
    } = body;

    // Validate required fields
    if (!name || !experiment_type || !primary_metric || !variants || variants.length < 2) {
      return NextResponse.json(
        { error: 'Missing required fields or insufficient variants' },
        { status: 400 }
      );
    }

    // Validate traffic percentages sum to 100
    const totalTraffic = variants.reduce((sum: number, v: VariantInput) =>
      sum + (v.traffic_percentage || 0), 0);
    if (Math.abs(totalTraffic - 100) > 0.01) {
      return NextResponse.json(
        { error: 'Variant traffic percentages must sum to 100' },
        { status: 400 }
      );
    }

    // Start transaction
    const { data: experiment, error: experimentError } = await supabase
      .from('ab_experiments')
      .insert({
        user_id: user.id,
        name,
        description,
        hypothesis,
        status: 'draft',
        experiment_type,
        primary_metric,
        secondary_metrics: secondary_metrics || [],
        traffic_percentage: traffic_percentage || parseInt(process.env.EXPERIMENTS_DEFAULT_TRAFFIC_PERCENTAGE || '100', 10),
        start_date,
        end_date,
        tags: tags || [],
        metadata: metadata || {}
      })
      .select()
      .single();

    if (experimentError) {
      debugLog('POST', `Experiment creation error: ${experimentError.message}`);
      return NextResponse.json(
        { error: `Failed to create experiment: ${experimentError.message}` },
        { status: 500 }
      );
    }

    // Create variants
    const variantsData = variants.map((v: VariantInput) => ({
      experiment_id: experiment.id,
      name: v.name,
      description: v.description,
      is_control: v.is_control || false,
      configuration: v.configuration || {},
      traffic_percentage: v.traffic_percentage
    }));

    const { data: createdVariants, error: variantsError } = await supabase
      .from('ab_experiment_variants')
      .insert(variantsData)
      .select();

    if (variantsError) {
      // Rollback experiment creation
      await supabase
        .from('ab_experiments')
        .delete()
        .eq('id', experiment.id);

      debugLog('POST', `Variants creation error: ${variantsError.message}`);
      return NextResponse.json(
        { error: `Failed to create variants: ${variantsError.message}` },
        { status: 500 }
      );
    }

    debugLog('POST', `Experiment created: ${experiment.id}`);

    return NextResponse.json({
      success: true,
      data: {
        ...experiment,
        ab_experiment_variants: createdVariants
      }
    });

  } catch (error) {
    console.error('[Experiments API - POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update experiment status or configuration
 */
export async function PATCH(req: NextRequest) {
  debugLog('PATCH', 'Request received');

  try {
    // Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { experiment_id, status, ...updateData } = body;

    if (!experiment_id) {
      return NextResponse.json(
        { error: 'experiment_id is required' },
        { status: 400 }
      );
    }

    debugLog('PATCH', `Updating experiment ${experiment_id}`);

    // Update experiment
    const { data: updatedExperiment, error: updateError } = await supabase
      .from('ab_experiments')
      .update({
        status,
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', experiment_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      debugLog('PATCH', `Update error: ${updateError.message}`);
      return NextResponse.json(
        { error: `Failed to update experiment: ${updateError.message}` },
        { status: 500 }
      );
    }

    debugLog('PATCH', `Experiment updated: ${experiment_id}`);

    return NextResponse.json({
      success: true,
      data: updatedExperiment
    });

  } catch (error) {
    console.error('[Experiments API - PATCH] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
